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
const { activeInYearSql } = require("../utils/membership");

const MISC_CATEGORY_NAME = "Misc";

// The catch-all every orphaned entry lands in. Created on demand so a database
// that predates the seed still gets one.
async function ensureMiscCategoryId(client) {
  const q = client ?? pool;
  const found = await q.query("SELECT id FROM revenue_categories WHERE name = $1", [
    MISC_CATEGORY_NAME,
  ]);
  if (found.rows[0]) return found.rows[0].id;
  const created = await q.query(
    "INSERT INTO revenue_categories (name) VALUES ($1) RETURNING id",
    [MISC_CATEGORY_NAME]
  );
  return created.rows[0].id;
}

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

// Deleting a category never deletes money. Any entries still pointing at it are
// moved to the Misc catch-all first, so the totals on the budget page are
// unchanged by the delete.
async function deleteRevenueCategory(req, res) {
  const { id } = idParamSchema.parse(req.params);

  const existingRes = await pool.query("SELECT name FROM revenue_categories WHERE id = $1", [id]);
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Category not found" } });
  }
  if (existing.name === MISC_CATEGORY_NAME) {
    return res.status(409).json({
      error: { message: `"${MISC_CATEGORY_NAME}" is the fallback category and can't be deleted.` },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const miscId = await ensureMiscCategoryId(client);
    const moved = await client.query(
      "UPDATE revenue SET category_id = $1 WHERE category_id = $2",
      [miscId, id]
    );
    await client.query("DELETE FROM revenue_categories WHERE id = $1", [id]);
    await client.query("COMMIT");
    return res.status(200).json({ reassigned: moved.rowCount, reassigned_to: MISC_CATEGORY_NAME });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
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
  // The client sends the year it is filing against; the date-derived value is
  // only the fallback for callers that don't.
  const schoolYear = payload.school_year ?? schoolYearStartForDate(payload.date);
  const cash = roundMoney(payload.cash_amount);
  const square = roundMoney(payload.square_amount);
  const etransfer = roundMoney(payload.etransfer_amount);
  const cheque = roundMoney(payload.cheque_amount);
  const total = roundMoney(cash + square + etransfer + cheque);
  const result = await pool.query(
    `
      INSERT INTO revenue
        (date, description, category_id, cash_amount, square_amount, etransfer_amount,
         cheque_amount, amount, school_year)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      payload.date,
      payload.description,
      payload.category_id,
      cash,
      square,
      etransfer,
      cheque,
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
    patch.etransfer_amount !== undefined ||
    patch.cheque_amount !== undefined;

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
  const nextCheque =
    patch.cheque_amount !== undefined
      ? patch.cheque_amount
      : Number(existing.cheque_amount ?? 0);

  const cash = roundMoney(nextCash);
  const square = roundMoney(nextSquare);
  const etransfer = roundMoney(nextEtransfer);
  const cheque = roundMoney(nextCheque);
  const total = roundMoney(cash + square + etransfer + cheque);

  // An explicit school_year wins. Failing that, a caller that sends a new date
  // gets the entry re-filed from it — the intuitive way to correct one. An edit
  // that touches neither keeps the filing as-is, so an unrelated change can't
  // quietly undo a deliberate override by re-deriving from the date.
  const schoolYear =
    patch.school_year !== undefined
      ? patch.school_year
      : patch.date !== undefined || existing.school_year === null
        ? schoolYearStartForDate(nextDate)
        : Number(existing.school_year);

  const updatedRes = await pool.query(
    `
      UPDATE revenue
      SET date = $1,
          description = $2,
          category_id = $3,
          cash_amount = $4,
          square_amount = $5,
          etransfer_amount = $6,
          cheque_amount = $7,
          amount = $8,
          school_year = $9
      WHERE id = $10
      RETURNING *
    `,
    [
      nextDate,
      nextDescription,
      nextCategoryId,
      cash,
      square,
      etransfer,
      cheque,
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

  // Dues revenue (payments), split by dues category. Scoped to brothers who
  // were in the chapter that year, not to who is Active today — otherwise
  // graduating someone erased dues they had already paid.
  const duesRowsRes = await pool.query(
    `
      SELECT p.amount, b.pledge_class
      FROM dues_payments p
      JOIN brothers b ON b.id = p.brother_id
      WHERE p.dues_year = $1
        AND ${activeInYearSql("b", "$1")}
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



