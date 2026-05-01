const { pool } = require("../db/pool");
const { duesPlanUpsertSchemaCompat } = require("../validation/duesConfig");
const { currentSchoolYearStart } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");

async function getCategoryPlan(year, category) {
  const planRes = await pool.query(
    "SELECT * FROM dues_plan_categories WHERE year = $1 AND category = $2",
    [year, category]
  );
  const plan = planRes.rows[0];
  if (!plan) return null;

  const instRes = await pool.query(
    "SELECT id, year, category, label, due_date, amount FROM dues_plan_category_instalments WHERE year = $1 AND category = $2 ORDER BY due_date ASC, id ASC",
    [year, category]
  );

  return {
    total_amount: plan.total_amount,
    instalments: instRes.rows,
  };
}

async function getDuesConfig(req, res) {
  // "year" is the school-year start (e.g. 2024 => 2024-2025)
  const year = req.query.year ? Number(req.query.year) : currentSchoolYearStart();

  // Prefer new category-based config
  const regular = await getCategoryPlan(year, "regular");
  const neophyte = await getCategoryPlan(year, "neophyte");

  if (regular && neophyte) {
    return res.status(200).json({ year, regular, neophyte });
  }

  // Backward-compatible fallback: old single-plan tables
  const legacyPlanRes = await pool.query(
    "SELECT * FROM dues_plans WHERE year = $1",
    [year]
  );
  const legacyPlan = legacyPlanRes.rows[0];
  if (!legacyPlan) {
    return res.status(404).json({ error: { message: "No dues plan for year" } });
  }
  const legacyInstRes = await pool.query(
    "SELECT id, year, label, due_date, amount FROM dues_plan_instalments WHERE year = $1 ORDER BY due_date ASC, id ASC",
    [year]
  );

  const mapped = {
    total_amount: legacyPlan.total_amount,
    instalments: legacyInstRes.rows,
  };

  return res.status(200).json({
    year,
    regular: mapped,
    neophyte: mapped,
  });
}

async function upsertDuesConfig(req, res) {
  const payload = duesPlanUpsertSchemaCompat.parse(req.body);

  const normalized =
    "regular" in payload
      ? payload
      : {
          year: payload.year,
          regular: { total_amount: payload.total_amount, instalments: payload.instalments },
          neophyte: { total_amount: payload.total_amount, instalments: payload.instalments },
        };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Upsert regular + neophyte into new category tables
    for (const category of ["regular", "neophyte"]) {
      const plan = normalized[category];
      await client.query(
        "INSERT INTO dues_plan_categories (year, category, total_amount) VALUES ($1, $2, $3) ON CONFLICT (year, category) DO UPDATE SET total_amount = EXCLUDED.total_amount",
        [normalized.year, category, roundMoney(plan.total_amount)]
      );
      await client.query(
        "DELETE FROM dues_plan_category_instalments WHERE year = $1 AND category = $2",
        [normalized.year, category]
      );
      for (const inst of plan.instalments) {
        await client.query(
          "INSERT INTO dues_plan_category_instalments (year, category, label, due_date, amount) VALUES ($1, $2, $3, $4, $5)",
          [normalized.year, category, inst.label ?? null, inst.due_date, roundMoney(inst.amount)]
        );
      }
    }

    await client.query("COMMIT");
    return res.status(200).json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { getDuesConfig, upsertDuesConfig };


