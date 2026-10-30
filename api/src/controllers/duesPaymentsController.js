const { pool } = require("../db/pool");
const { duesPaymentCreateSchema, duesPaymentUpdateSchema } = require("../validation/duesPayments");
const { idParamSchema } = require("../validation/common");
const { currentSchoolYearStart, schoolYearStartForDate, todayInToronto } = require("../utils/schoolYear");
const { duesCategoryForBrother } = require("../utils/pledgeClass");
const {
  loadDuesPlanContext,
  loadDuesPaidByBrother,
  duesBalanceFor,
} = require("../services/duesBalance");
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
  const asOf = todayInToronto();

  const ctx = await loadDuesPlanContext(year, asOf);
  if (!ctx) {
    return res.status(404).json({ error: { message: "No dues plans for year" } });
  }

  const [brothersRes, paidByBrother] = await Promise.all([
    pool.query(
      "SELECT id, first_name, last_name, pledge_class FROM brothers ORDER BY first_name ASC, last_name ASC"
    ),
    loadDuesPaidByBrother(year),
  ]);

  const enriched = brothersRes.rows.map((b) =>
    duesBalanceFor(b, ctx, paidByBrother.get(Number(b.id)))
  );

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


