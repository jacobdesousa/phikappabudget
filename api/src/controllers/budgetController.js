const { pool } = require("../db/pool");
const { currentSchoolYearStart } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");
const z = require("zod");

const allocationRowSchema = z.object({
  category_id: z.number().int().positive(),
  budgeted_amount: z.number(),
});

const expenseAllocationsSchema = z.object({ rows: z.array(allocationRowSchema) });
const revenueAllocationsSchema = z.object({ rows: z.array(allocationRowSchema) });

const reconciliationSchema = z.object({
  emergency_reserve: z.number().min(0),
});

const duesConfigSchema = z.object({
  estimated_pledges: z.number().int().min(0),
  chapter_bonus_monthly_rate: z.number().min(0),
});

async function getBudgetSummary(req, res) {
  const yearRaw = req.query.year;
  const year = yearRaw ? Number(yearRaw) : currentSchoolYearStart();
  const prevYear = year - 1;

  // Expense rows
  const expenseRes = await pool.query(
    `
    SELECT
      ec.id                                              AS category_id,
      ec.name                                            AS category_name,
      COALESCE(bea.budgeted_amount, 0)                   AS budgeted_amount,
      COALESCE(curr.actual_amount, 0)                    AS actual_amount,
      COALESCE(prev.actual_amount, 0)                    AS prior_year_actual
    FROM expense_categories ec
    LEFT JOIN budget_expense_allocations bea
      ON bea.category_id = ec.id AND bea.school_year = $1
    LEFT JOIN (
      SELECT category_id, SUM(amount) AS actual_amount
      FROM expenses
      WHERE school_year = $1 AND status IN ('approved', 'paid')
      GROUP BY category_id
    ) curr ON curr.category_id = ec.id
    LEFT JOIN (
      SELECT category_id, SUM(amount) AS actual_amount
      FROM expenses
      WHERE school_year = $2 AND status IN ('approved', 'paid')
      GROUP BY category_id
    ) prev ON prev.category_id = ec.id
    ORDER BY ec.name ASC
    `,
    [year, prevYear]
  );

  const expense_rows = expenseRes.rows.map((r) => ({
    category_id: r.category_id,
    category_name: r.category_name,
    budgeted_amount: roundMoney(Number(r.budgeted_amount)),
    actual_amount: roundMoney(Number(r.actual_amount)),
    prior_year_actual: roundMoney(Number(r.prior_year_actual)),
    remaining: roundMoney(Number(r.budgeted_amount) - Number(r.actual_amount)),
  }));

  // Revenue rows (from revenue table)
  const revenueCatRes = await pool.query(
    `
    SELECT
      rc.id                                              AS category_id,
      rc.name                                            AS category_name,
      COALESCE(bra.budgeted_amount, 0)                   AS budgeted_amount,
      COALESCE(curr.actual_amount, 0)                    AS actual_amount,
      COALESCE(prev.actual_amount, 0)                    AS prior_year_actual
    FROM revenue_categories rc
    LEFT JOIN budget_revenue_allocations bra
      ON bra.category_id = rc.id AND bra.school_year = $1
    LEFT JOIN (
      SELECT category_id, SUM(amount) AS actual_amount
      FROM revenue
      WHERE school_year = $1
      GROUP BY category_id
    ) curr ON curr.category_id = rc.id
    LEFT JOIN (
      SELECT category_id, SUM(amount) AS actual_amount
      FROM revenue
      WHERE school_year = $2
      GROUP BY category_id
    ) prev ON prev.category_id = rc.id
    ORDER BY rc.name ASC
    `,
    [year, prevYear]
  );

  // Individual revenue entries for expand dropdown
  const revenueEntriesRes = await pool.query(
    `
    SELECT id, date, description, category_id, amount,
           COALESCE(cash_amount, 0) AS cash_amount,
           COALESCE(square_amount, 0) AS square_amount,
           COALESCE(etransfer_amount, 0) AS etransfer_amount
    FROM revenue
    WHERE school_year = $1
    ORDER BY date DESC
    `,
    [year]
  );

  const entriesByCategory = {};
  for (const e of revenueEntriesRes.rows) {
    const cid = e.category_id;
    if (!entriesByCategory[cid]) entriesByCategory[cid] = [];
    entriesByCategory[cid].push({
      id: e.id,
      date: e.date,
      description: e.description,
      amount: roundMoney(Number(e.amount)),
      cash_amount: roundMoney(Number(e.cash_amount)),
      square_amount: roundMoney(Number(e.square_amount)),
      etransfer_amount: roundMoney(Number(e.etransfer_amount)),
    });
  }

  // ── Dues config: compute budgeted amount from active count + rates ──────────
  // Count actives who are "regular" payers: exclude neophytes (Fall {year} and Spring {year+1})
  // matching the same logic as duesCategoryForBrother in pledgeClass.js
  const activeCountRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM brothers
     WHERE status = 'Active'
       AND pledge_class NOT IN ('Fall ' || $1::int::text, 'Spring ' || ($1::int + 1)::text)`,
    [year]
  );
  const active_count = Number(activeCountRes.rows[0]?.count ?? 0);

  // Rates come from the dues settings (dues_plan_categories), not budget_dues_config
  const duesPlanRes = await pool.query(
    `SELECT category, total_amount FROM dues_plan_categories WHERE year = $1 AND category IN ('regular', 'neophyte')`,
    [year]
  );
  const dues_rate_active = roundMoney(Number(duesPlanRes.rows.find((r) => r.category === "regular")?.total_amount ?? 0));
  const dues_rate_pledge = roundMoney(Number(duesPlanRes.rows.find((r) => r.category === "neophyte")?.total_amount ?? 0));

  const budgetCfgRes = await pool.query(
    `SELECT estimated_pledges, chapter_bonus_monthly_rate FROM budget_dues_config WHERE school_year = $1`,
    [year]
  );
  const bdc = budgetCfgRes.rows[0] ?? {};
  const dues_config = {
    active_count,
    dues_rate_active,
    dues_rate_pledge,
    estimated_pledges: Number(bdc.estimated_pledges ?? 15),
    chapter_bonus_monthly_rate: roundMoney(Number(bdc.chapter_bonus_monthly_rate ?? 500)),
  };
  const dues_budgeted = roundMoney(
    active_count * dues_config.dues_rate_active +
    dues_config.estimated_pledges * dues_config.dues_rate_pledge
  );

  // Chapter bonus: 8 bonus months per year × monthly rate (e.g. 8 × $500 = $4,000)
  const chapter_bonus_budgeted = roundMoney(8 * dues_config.chapter_bonus_monthly_rate);

  // ── Build revenue rows, overriding Dues budgeted ───────────────────────────
  const revenue_rows = revenueCatRes.rows.map((r) => {
    const isDues = r.category_name === "Dues";
    const isChapterBonus = r.category_name === "Chapter Bonus";

    const budgeted_amount = isDues
      ? dues_budgeted
      : isChapterBonus
      ? chapter_bonus_budgeted
      : roundMoney(Number(r.budgeted_amount));

    return {
      category_id: r.category_id,
      category_name: r.category_name,
      budgeted_amount,
      actual_amount: roundMoney(Number(r.actual_amount)),
      prior_year_actual: roundMoney(Number(r.prior_year_actual)),
      entries: entriesByCategory[r.category_id] ?? [],
      is_dues: isDues,
      is_chapter_bonus: isChapterBonus,
    };
  });

  // Reconciliation
  const reconcRes = await pool.query(
    `SELECT emergency_reserve FROM budget_reconciliation WHERE school_year = $1`,
    [year]
  );
  const emergency_reserve = roundMoney(Number(reconcRes.rows[0]?.emergency_reserve ?? 0));

  // Outstanding disbursements
  const disbRes = await pool.query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE school_year = $1 AND status = 'approved'`,
    [year]
  );
  const outstanding_disbursements = {
    count: disbRes.rows[0]?.count ?? 0,
    total: roundMoney(Number(disbRes.rows[0]?.total ?? 0)),
  };

  // Totals
  const expense_budgeted = expense_rows.reduce((s, r) => s + r.budgeted_amount, 0);
  const expense_actual = expense_rows.reduce((s, r) => s + r.actual_amount, 0);
  const revenue_budgeted = revenue_rows.reduce((s, r) => s + r.budgeted_amount, 0);
  const revenue_actual = revenue_rows.reduce((s, r) => s + r.actual_amount, 0);
  const net = roundMoney(revenue_actual - expense_actual);

  // cash_on_hand = available to spend = rev_actual − exp_actual
  // bank_balance = cash_on_hand + emergency_reserve (total known money)
  // accounts_receivable = budgeted revenue still to come in (floor 0)
  const cash_on_hand = roundMoney(revenue_actual - expense_actual);
  const bank_balance = roundMoney(cash_on_hand + emergency_reserve);
  const accounts_receivable = roundMoney(Math.max(0, revenue_budgeted - revenue_actual));

  const reconciliation = {
    cash_amount: cash_on_hand,
    emergency_reserve,
    bank_balance,
    accounts_receivable,
  };

  return res.status(200).json({
    year,
    expense_rows,
    revenue_rows,
    dues_config,
    reconciliation,
    outstanding_disbursements,
    totals: {
      expense: {
        budgeted: roundMoney(expense_budgeted),
        actual: roundMoney(expense_actual),
        remaining: roundMoney(expense_budgeted - expense_actual),
      },
      revenue: {
        budgeted: roundMoney(revenue_budgeted),
        actual: roundMoney(revenue_actual),
      },
      net,
    },
  });
}

async function batchUpsertExpenseAllocations(req, res) {
  const yearRaw = req.query.year;
  const year = yearRaw ? Number(yearRaw) : currentSchoolYearStart();
  const { rows } = expenseAllocationsSchema.parse(req.body);

  for (const row of rows) {
    await pool.query(
      `INSERT INTO budget_expense_allocations (school_year, category_id, budgeted_amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (school_year, category_id) DO UPDATE SET budgeted_amount = EXCLUDED.budgeted_amount`,
      [year, row.category_id, row.budgeted_amount]
    );
  }
  return res.status(200).json({ ok: true });
}

async function batchUpsertRevenueAllocations(req, res) {
  const yearRaw = req.query.year;
  const year = yearRaw ? Number(yearRaw) : currentSchoolYearStart();
  const { rows } = revenueAllocationsSchema.parse(req.body);

  for (const row of rows) {
    await pool.query(
      `INSERT INTO budget_revenue_allocations (school_year, category_id, budgeted_amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (school_year, category_id) DO UPDATE SET budgeted_amount = EXCLUDED.budgeted_amount`,
      [year, row.category_id, row.budgeted_amount]
    );
  }
  return res.status(200).json({ ok: true });
}

async function upsertReconciliation(req, res) {
  const yearRaw = req.query.year;
  const year = yearRaw ? Number(yearRaw) : currentSchoolYearStart();
  const payload = reconciliationSchema.parse(req.body);

  await pool.query(
    `INSERT INTO budget_reconciliation (school_year, emergency_reserve)
     VALUES ($1, $2)
     ON CONFLICT (school_year) DO UPDATE SET emergency_reserve = EXCLUDED.emergency_reserve`,
    [year, payload.emergency_reserve]
  );
  return res.status(200).json({ ok: true });
}

async function upsertBudgetDuesConfig(req, res) {
  const yearRaw = req.query.year;
  const year = yearRaw ? Number(yearRaw) : currentSchoolYearStart();
  const payload = duesConfigSchema.parse(req.body);

  await pool.query(
    `INSERT INTO budget_dues_config (school_year, estimated_pledges, chapter_bonus_monthly_rate)
     VALUES ($1, $2, $3)
     ON CONFLICT (school_year) DO UPDATE SET
       estimated_pledges          = EXCLUDED.estimated_pledges,
       chapter_bonus_monthly_rate = EXCLUDED.chapter_bonus_monthly_rate`,
    [year, payload.estimated_pledges, payload.chapter_bonus_monthly_rate]
  );
  return res.status(200).json({ ok: true });
}

module.exports = {
  getBudgetSummary,
  batchUpsertExpenseAllocations,
  batchUpsertRevenueAllocations,
  upsertReconciliation,
  upsertBudgetDuesConfig,
};
