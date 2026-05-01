const { pool } = require("../db/pool");
const { duesPaymentCreateSchema, duesPaymentUpdateSchema } = require("../validation/duesPayments");
const { idParamSchema } = require("../validation/common");
const { currentSchoolYearStart, schoolYearStartForDate } = require("../utils/schoolYear");
const { duesCategoryForBrother } = require("../utils/pledgeClass");
const { roundMoney } = require("../utils/money");

async function listDuesPayments(req, res) {
  const brotherIdRaw = req.query.brother_id;
  const yearRaw = req.query.year;
  const year = yearRaw ? Number(yearRaw) : undefined;

  if (brotherIdRaw) {
    const brotherId = Number(brotherIdRaw);
    const { rows } = year
      ? await pool.query(
          "SELECT * FROM dues_payments WHERE brother_id = $1 AND dues_year = $2 ORDER BY paid_at DESC, id DESC",
          [brotherId, year]
        )
      : await pool.query(
          "SELECT * FROM dues_payments WHERE brother_id = $1 ORDER BY paid_at DESC, id DESC",
          [brotherId]
        );
    return res.status(200).json(rows);
  }

  const { rows } = year
    ? await pool.query(
        "SELECT * FROM dues_payments WHERE dues_year = $1 ORDER BY paid_at DESC, id DESC",
        [year]
      )
    : await pool.query("SELECT * FROM dues_payments ORDER BY paid_at DESC, id DESC");
  return res.status(200).json(rows);
}

async function duesPaymentsSummary(req, res) {
  // "year" is the school-year start (e.g. 2024 => 2024-2025)
  const year = req.query.year ? Number(req.query.year) : currentSchoolYearStart();

  // Load category plans
  const plansRes = await pool.query(
    "SELECT year, category, total_amount FROM dues_plan_categories WHERE year = $1",
    [year]
  );
  const plans = Object.fromEntries(plansRes.rows.map((r) => [r.category, r]));
  if (!plans.regular || !plans.neophyte) {
    return res.status(404).json({ error: { message: "No dues plans for year" } });
  }

  const instRes = await pool.query(
    "SELECT category, due_date, amount FROM dues_plan_category_instalments WHERE year = $1",
    [year]
  );

  const today = new Date();
  const dueToDateByCategory = instRes.rows.reduce((acc, r) => {
    const dueDate = new Date(r.due_date);
    if (dueDate <= today) {
      acc[r.category] = (acc[r.category] ?? 0) + Number(r.amount);
    }
    return acc;
  }, {});

  const brothersRes = await pool.query(
    "SELECT id, first_name, last_name, pledge_class FROM brothers ORDER BY last_name ASC, first_name ASC"
  );

  const paymentsAggRes = await pool.query(
    `
      SELECT
        brother_id,
        COALESCE(SUM(amount), 0) as total_paid,
        COUNT(id) as payment_count,
        MAX(paid_at) as last_paid_at
      FROM dues_payments
      WHERE dues_year = $1
      GROUP BY brother_id
    `,
    [year]
  );

  const paymentsByBrother = new Map(
    paymentsAggRes.rows.map((r) => [Number(r.brother_id), r])
  );

  const enriched = brothersRes.rows.map((b) => {
    const brotherId = Number(b.id);
    const agg = paymentsByBrother.get(brotherId) ?? {
      total_paid: 0,
      payment_count: 0,
      last_paid_at: null,
    };

    const category = duesCategoryForBrother(b.pledge_class, year);
    const totalOwed = Number(plans[category].total_amount);
    const dueToDate = Number(dueToDateByCategory[category] ?? 0);
    const totalPaid = Number(agg.total_paid ?? 0);
    const balanceTotal = totalOwed - totalPaid;
    const balanceDueToDate = dueToDate - totalPaid;

    return {
      brother_id: brotherId,
      first_name: b.first_name,
      last_name: b.last_name,
      pledge_class: b.pledge_class,
      dues_category: category,
      total_paid: totalPaid,
      payment_count: Number(agg.payment_count ?? 0),
      last_paid_at: agg.last_paid_at,
      year,
      total_owed: totalOwed,
      due_to_date: dueToDate,
      balance_total: balanceTotal,
      balance_due_to_date: balanceDueToDate,
      is_behind: balanceDueToDate > 0,
    };
  });

  return res.status(200).json(enriched);
}

async function createDuesPayment(req, res) {
  const payload = duesPaymentCreateSchema.parse(req.body);

  const duesYear =
    payload.dues_year ?? schoolYearStartForDate(payload.paid_at);

  const result = await pool.query(
    "INSERT INTO dues_payments (brother_id, paid_at, amount, memo, dues_year) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [
      payload.brother_id,
      payload.paid_at,
      roundMoney(payload.amount),
      payload.memo ?? null,
      duesYear,
    ]
  );

  return res.status(201).json(result.rows[0]);
}

async function deleteDuesPayment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const result = await pool.query("DELETE FROM dues_payments WHERE id = $1", [
    id,
  ]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: { message: "Payment not found" } });
  }
  return res.status(204).send();
}

async function updateDuesPayment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = duesPaymentUpdateSchema.parse(req.body);

  const existingRes = await pool.query("SELECT * FROM dues_payments WHERE id = $1", [id]);
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Payment not found" } });
  }

  const nextPaidAt = payload.paid_at !== undefined ? payload.paid_at : existing.paid_at;
  const nextAmount = payload.amount !== undefined ? roundMoney(payload.amount) : roundMoney(existing.amount);
  const nextMemo = payload.memo !== undefined ? payload.memo : existing.memo;

  const result = await pool.query(
    "UPDATE dues_payments SET paid_at = $1, amount = $2, memo = $3 WHERE id = $4 RETURNING *",
    [nextPaidAt, nextAmount, nextMemo, id]
  );

  return res.status(200).json(result.rows[0]);
}

module.exports = {
  listDuesPayments,
  duesPaymentsSummary,
  createDuesPayment,
  deleteDuesPayment,
  updateDuesPayment,
};


