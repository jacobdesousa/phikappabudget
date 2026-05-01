const { pool } = require("../db/pool");
const {
  revenueCategorySchema,
  revenueCreateSchema,
  revenueUpdateSchema,
} = require("../validation/revenue");
const { currentSchoolYearStart, schoolYearStartForDate } = require("../utils/schoolYear");
const { duesCategoryForBrother } = require("../utils/pledgeClass");
const { idParamSchema } = require("../validation/common");
const { roundMoney } = require("../utils/money");

async function listRevenueCategories(req, res) {
  const { rows } = await pool.query("SELECT * FROM revenue_categories");
  res.status(200).json(rows);
}

async function createRevenueCategory(req, res) {
  const payload = revenueCategorySchema.parse(req.body);
  const result = await pool.query(
    "INSERT INTO revenue_categories (name) VALUES ($1) RETURNING *",
    [payload.name]
  );
  res.status(201).json(result.rows[0]);
}

async function updateRevenueCategory(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = revenueCategorySchema.parse(req.body);
  const result = await pool.query(
    "UPDATE revenue_categories SET name = $1 WHERE id = $2 RETURNING *",
    [payload.name, id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ error: { message: "Category not found" } });
  }
  return res.status(200).json(result.rows[0]);
}

async function deleteRevenueCategory(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const usedRes = await pool.query("SELECT COUNT(*)::int AS c FROM revenue WHERE category_id = $1", [
    id,
  ]);
  if ((usedRes.rows[0]?.c ?? 0) > 0) {
    return res.status(409).json({
      error: { message: "Category is in use by revenue entries. Reassign entries before deleting." },
    });
  }
  const result = await pool.query("DELETE FROM revenue_categories WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: { message: "Category not found" } });
  }
  return res.status(204).send();
}

async function listRevenue(req, res) {
  const yearRaw = req.query.year;
  const year = yearRaw ? Number(yearRaw) : currentSchoolYearStart();

  const { rows } = await pool.query(
    `
      SELECT
        r.*,
        rc.name as category_name
      FROM revenue r
      LEFT JOIN revenue_categories rc ON rc.id = r.category_id
      WHERE ($1::int IS NULL OR r.school_year = $1::int)
      ORDER BY r.date DESC, r.id DESC
    `,
    [Number.isFinite(year) ? year : null]
  );
  res.status(200).json(rows);
}

async function createRevenue(req, res) {
  const payload = revenueCreateSchema.parse(req.body);
  const schoolYear = schoolYearStartForDate(payload.date);
  const cash = roundMoney(payload.cash_amount);
  const square = roundMoney(payload.square_amount);
  const etransfer = roundMoney(payload.etransfer_amount);
  const total = roundMoney(cash + square + etransfer);
  const result = await pool.query(
    `
      INSERT INTO revenue
        (date, description, category_id, cash_amount, square_amount, etransfer_amount, amount, school_year)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      payload.date,
      payload.description,
      payload.category_id,
      cash,
      square,
      etransfer,
      total,
      schoolYear,
    ]
  );
  const row = result.rows[0];
  const catRes = await pool.query("SELECT name FROM revenue_categories WHERE id = $1", [
    row.category_id,
  ]);
  res.status(201).json({ ...row, category_name: catRes.rows[0]?.name ?? null });
}

async function updateRevenue(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const patch = revenueUpdateSchema.parse(req.body);

  const existingRes = await pool.query("SELECT * FROM revenue WHERE id = $1", [id]);
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Revenue entry not found" } });
  }

  const nextDate = patch.date !== undefined ? patch.date : existing.date;
  const nextDescription =
    patch.description !== undefined ? patch.description : existing.description;
  const nextCategoryId =
    patch.category_id !== undefined ? patch.category_id : existing.category_id;

  const hasBreakdown =
    patch.cash_amount !== undefined ||
    patch.square_amount !== undefined ||
    patch.etransfer_amount !== undefined;

  const nextCash =
    patch.cash_amount !== undefined
      ? patch.cash_amount
      : hasBreakdown
        ? Number(existing.cash_amount ?? 0)
        : patch.amount !== undefined
          ? patch.amount
          : Number(existing.cash_amount ?? existing.amount ?? 0);
  const nextSquare =
    patch.square_amount !== undefined ? patch.square_amount : Number(existing.square_amount ?? 0);
  const nextEtransfer =
    patch.etransfer_amount !== undefined
      ? patch.etransfer_amount
      : Number(existing.etransfer_amount ?? 0);

  const cash = roundMoney(nextCash);
  const square = roundMoney(nextSquare);
  const etransfer = roundMoney(nextEtransfer);
  const total = roundMoney(cash + square + etransfer);
  const schoolYear = schoolYearStartForDate(nextDate);

  const updatedRes = await pool.query(
    `
      UPDATE revenue
      SET date = $1,
          description = $2,
          category_id = $3,
          cash_amount = $4,
          square_amount = $5,
          etransfer_amount = $6,
          amount = $7,
          school_year = $8
      WHERE id = $9
      RETURNING *
    `,
    [
      nextDate,
      nextDescription,
      nextCategoryId,
      cash,
      square,
      etransfer,
      total,
      schoolYear,
      id,
    ]
  );

  const row = updatedRes.rows[0];
  const catRes = await pool.query("SELECT name FROM revenue_categories WHERE id = $1", [
    row.category_id,
  ]);
  return res.status(200).json({ ...row, category_name: catRes.rows[0]?.name ?? null });
}

async function deleteRevenue(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const result = await pool.query("DELETE FROM revenue WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: { message: "Revenue entry not found" } });
  }
  return res.status(204).send();
}

async function revenueSummary(req, res) {
  // "year" is the school-year start (e.g. 2024 => 2024-2025)
  const year = req.query.year ? Number(req.query.year) : currentSchoolYearStart();

  // Manual revenue
  const manualRes = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM revenue WHERE school_year = $1",
    [year]
  );
  const manualTotal = Number(manualRes.rows[0]?.total ?? 0);

  // Dues revenue (payments) for Active brothers, split by dues category.
  const duesRowsRes = await pool.query(
    `
      SELECT p.amount, b.pledge_class
      FROM dues_payments p
      JOIN brothers b ON b.id = p.brother_id
      WHERE p.dues_year = $1
        AND b.status = 'Active'
    `,
    [year]
  );

  let duesRegular = 0;
  let duesNeophyte = 0;
  for (const r of duesRowsRes.rows) {
    const category = duesCategoryForBrother(r.pledge_class, year);
    const amt = Number(r.amount ?? 0);
    if (category === "neophyte") duesNeophyte += amt;
    else duesRegular += amt;
  }
  const duesTotal = duesRegular + duesNeophyte;

  return res.status(200).json({
    year,
    manual_total: manualTotal,
    dues_total: duesTotal,
    dues_regular_total: duesRegular,
    dues_neophyte_total: duesNeophyte,
    total_revenue: manualTotal + duesTotal,
  });
}

module.exports = {
  listRevenueCategories,
  createRevenueCategory,
  updateRevenueCategory,
  deleteRevenueCategory,
  listRevenue,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  revenueSummary,
};



