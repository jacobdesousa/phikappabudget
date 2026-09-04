const { pool } = require("../db/pool");
const { currentSchoolYearStart } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");
const { totalOwedFor } = require("../utils/houseFees");
const { activeInYearSql } = require("../utils/membership");
const z = require("zod");
const { SETTLED_EXPENSE_STATUSES } = require("../validation/expenses");

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

// Forecast the chapter's cut of residence fees for a school year: every room
// assignment's total owed across both sessions, times the internal payee's
// percentage (PKSAB, 11%). Read-only — the house account stays separate.
async function houseRebateBudgeted(year) {
  const [assignmentsRes, sessionsRes, ratesRes, payeeRes] = await Promise.all([
    pool.query(
      `SELECT session_type, room_id, occupancy, base_amount, amount_override,
              member_discount, double_rebate, prepay_discount
       FROM house_assignments WHERE school_year = $1`,
      [year]
    ),
    pool.query(
      `SELECT session_type, terms, member_rebate, prepay_discount_pct
       FROM house_sessions WHERE school_year = $1`,
      [year]
    ),
    pool.query(
      `SELECT session_type, room_id, capacity, rate_per_person
       FROM house_room_rates WHERE school_year = $1`,
      [year]
    ),
    pool.query(
      `SELECT payee, pct FROM house_disbursement_payees
       WHERE school_year = $1 AND is_internal = TRUE
       ORDER BY sort_order ASC LIMIT 1`,
      [year]
    ),
  ]);

  const sessionByType = new Map(sessionsRes.rows.map((s) => [s.session_type, s]));
  const rateByKey = new Map(
    ratesRes.rows.map((r) => [`${r.session_type}:${r.room_id}`, r])
  );

  // Per-session subtotals so the UI can show where the number comes from.
  const bySession = new Map();
  for (const a of assignmentsRes.rows) {
    const owed = totalOwedFor(
      a,
      sessionByType.get(a.session_type),
      rateByKey.get(`${a.session_type}:${a.room_id}`)
    );
    const bucket = bySession.get(a.session_type) ?? { assignments: 0, fees_total: 0 };
    bucket.assignments += 1;
    bucket.fees_total += owed;
    bySession.set(a.session_type, bucket);
  }

  const sessions = [...bySession.entries()]
    .map(([session_type, b]) => ({
      session_type,
      assignments: b.assignments,
      fees_total: roundMoney(b.fees_total),
    }))
    .sort((a, b) => a.session_type.localeCompare(b.session_type));

  const fees_total = roundMoney(sessions.reduce((sum, s) => sum + s.fees_total, 0));

  const pct = Number(payeeRes.rows[0]?.pct ?? 0);
  return {
    fees_total,
    pct,
    payee: payeeRes.rows[0]?.payee ?? null,
    sessions,
    budgeted: roundMoney(fees_total * (pct / 100)),
  };
}

// Cumulative cash left over from every prior school year: all revenue actuals
// minus all expense actuals booked before `year`. Because it sums everything
// that came before, it already contains the year-before's own carry-over, so
// the chain stays consistent no matter how many years are in the books.
async function priorYearCarryover(year) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM revenue WHERE school_year < $1), 0) AS revenue,
       COALESCE((SELECT SUM(amount) FROM expenses
                 WHERE school_year < $1 AND status = ANY($2::text[])), 0) AS expense`,
    [year, SETTLED_EXPENSE_STATUSES]
  );
  return roundMoney(Number(rows[0].revenue) - Number(rows[0].expense));
}

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
      WHERE school_year = $1 AND status = ANY($3::text[])
      GROUP BY category_id
    ) curr ON curr.category_id = ec.id
    LEFT JOIN (
      SELECT category_id, SUM(amount) AS actual_amount
      FROM expenses
      WHERE school_year = $2 AND status = ANY($3::text[])
      GROUP BY category_id
    ) prev ON prev.category_id = ec.id
    -- Only the categories this year offers, plus any still carrying money or a
    -- budgeted figure. Availability decides what can be picked, never what can
    -- be seen: filtering a category with actuals out of the budget would drop
    -- real dollars from the totals.
    WHERE EXISTS (
      SELECT 1 FROM expense_category_years ecy
      WHERE ecy.category_id = ec.id AND ecy.school_year = $1
    )
    OR COALESCE(bea.budgeted_amount, 0) <> 0
    OR COALESCE(curr.actual_amount, 0) <> 0
    ORDER BY ec.name ASC
    `,
    [year, prevYear, SETTLED_EXPENSE_STATUSES]
  );

  const expense_rows = expenseRes.rows.map((r) => ({
    category_id: r.category_id,
    category_name: r.category_name,
    budgeted_amount: roundMoney(Number(r.budgeted_amount)),
    actual_amount: roundMoney(Number(r.actual_amount)),
    prior_year_actual: roundMoney(Number(r.prior_year_actual)),
    remaining: roundMoney(Number(r.budgeted_amount) - Number(r.actual_amount)),
  }));

  // Synthetic revenue rows that don't come from revenue_categories.
  const revenue_rows_extra = [];

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
    -- Same rule as the expense rows: this year's categories, plus anything
    -- still carrying money or a budgeted figure.
    WHERE EXISTS (
      SELECT 1 FROM revenue_category_years rcy
      WHERE rcy.category_id = rc.id AND rcy.school_year = $1
    )
    OR COALESCE(bra.budgeted_amount, 0) <> 0
    OR COALESCE(curr.actual_amount, 0) <> 0
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
           COALESCE(etransfer_amount, 0) AS etransfer_amount,
           COALESCE(cheque_amount, 0) AS cheque_amount
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
      cheque_amount: roundMoney(Number(e.cheque_amount)),
    });
  }

  // ── Dues config: compute budgeted amount from active count + rates ──────────
  // Count actives who are "regular" payers: exclude neophytes (Fall {year} and Spring {year+1})
  // matching the same logic as duesCategoryForBrother in pledgeClass.js
  const activeCountRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM brothers b
     WHERE ${activeInYearSql("b", "$1")}
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

  // Dues money is collected on the dues page, which writes to dues_payments —
  // a separate ledger from `revenue`. Summing it here is what makes the Dues
  // actual reflect what's actually been collected, the same way the budgeted
  // figure is derived live rather than stored as an allocation.
  const duesPaidRes = await pool.query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS total
     FROM dues_payments WHERE dues_year = $1`,
    [year]
  );
  dues_config.payments_count = Number(duesPaidRes.rows[0]?.count ?? 0);
  dues_config.payments_total = roundMoney(Number(duesPaidRes.rows[0]?.total ?? 0));

  const duesPaidPrevRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM dues_payments WHERE dues_year = $1`,
    [prevYear]
  );
  const dues_paid_prior = roundMoney(Number(duesPaidPrevRes.rows[0]?.total ?? 0));

  // Chapter bonus: 8 bonus months per year × monthly rate (e.g. 8 × $500 = $4,000)
  const chapter_bonus_budgeted = roundMoney(8 * dues_config.chapter_bonus_monthly_rate);

  // House fee rebate: the chapter's share of residence fees. Read-only against
  // the house tables — actuals arrive as ordinary revenue rows when the
  // disbursement is received, same as Chapter Bonus.
  const house_rebate = await houseRebateBudgeted(year);
  const house_rebate_budgeted = house_rebate.budgeted;

  // Prior-year surplus/deficit. The bank account doesn't reset in September, so
  // last year's leftover cash is carried in as a fixed line — positive lands in
  // revenue, negative in expenses — and counts as both budgeted and actual,
  // because it is money already in (or already out of) the account.
  const carryover = await priorYearCarryover(year);
  const carryover_prior = await priorYearCarryover(prevYear);
  const CARRYOVER_ID = -1;
  if (carryover > 0) {
    revenue_rows_extra.push({
      category_id: CARRYOVER_ID,
      category_name: "Prior Year Surplus",
      budgeted_amount: carryover,
      actual_amount: carryover,
      prior_year_actual: Math.max(0, carryover_prior),
      entries: [],
      is_dues: false,
      is_chapter_bonus: false,
      is_house_rebate: false,
      is_carryover: true,
    });
  } else if (carryover < 0) {
    expense_rows.push({
      category_id: CARRYOVER_ID,
      category_name: "Prior Year Deficit",
      budgeted_amount: Math.abs(carryover),
      actual_amount: Math.abs(carryover),
      prior_year_actual: Math.abs(Math.min(0, carryover_prior)),
      remaining: 0,
      is_carryover: true,
    });
  }

  // ── Build revenue rows, overriding Dues budgeted ───────────────────────────
  const revenue_rows = revenueCatRes.rows.map((r) => {
    const isDues = r.category_name === "Dues";
    const isChapterBonus = r.category_name === "Chapter Bonus";
    const isHouseRebate = r.category_name === "House Fee Rebate";

    const budgeted_amount = isDues
      ? dues_budgeted
      : isChapterBonus
      ? chapter_bonus_budgeted
      : isHouseRebate
      ? house_rebate_budgeted
      : roundMoney(Number(r.budgeted_amount));

    // Dues collections come from dues_payments. Any hand-entered revenue row
    // filed under Dues is added on top rather than replaced, so a manual entry
    // is never silently dropped from the totals.
    const actual_amount = isDues
      ? roundMoney(Number(r.actual_amount) + dues_config.payments_total)
      : roundMoney(Number(r.actual_amount));
    const prior_year_actual = isDues
      ? roundMoney(Number(r.prior_year_actual) + dues_paid_prior)
      : roundMoney(Number(r.prior_year_actual));

    return {
      category_id: r.category_id,
      category_name: r.category_name,
      budgeted_amount,
      actual_amount,
      prior_year_actual,
      entries: entriesByCategory[r.category_id] ?? [],
      is_dues: isDues,
      is_chapter_bonus: isChapterBonus,
      is_house_rebate: isHouseRebate,
      is_carryover: false,
    };
  });
  revenue_rows.push(...revenue_rows_extra);

  // Reconciliation
  const reconcRes = await pool.query(
    `SELECT emergency_reserve FROM budget_reconciliation WHERE school_year = $1`,
    [year]
  );
  const emergency_reserve = roundMoney(Number(reconcRes.rows[0]?.emergency_reserve ?? 0));

  // Outstanding disbursements
  const disbRes = await pool.query(
    // Must match getOutstandingDisbursements and the expenses page: an
    // approved expense that already has a cheque number is not outstanding.
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE school_year = $1 AND status = 'approved'
       AND (cheque_number IS NULL OR cheque_number = '')`,
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
    house_rebate,
    carryover,
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
