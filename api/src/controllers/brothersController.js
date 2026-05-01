const { pool } = require("../db/pool");
const { brotherSchema } = require("../validation/brothers");
const { idParamSchema } = require("../validation/common");
const { currentSchoolYearStart } = require("../utils/schoolYear");
const { duesCategoryForBrother } = require("../utils/pledgeClass");

async function listBrothers(req, res) {
  const { rows } = await pool.query(`
    SELECT b.*,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', bo.id,
          'office_key', bo.office_key,
          'display_name', o.display_name,
          'start_date', to_char(bo.start_date, 'YYYY-MM-DD'),
          'end_date', to_char(bo.end_date, 'YYYY-MM-DD')
        ) ORDER BY bo.start_date DESC, bo.id DESC)
        FROM brother_offices bo
        JOIN offices o ON o.office_key = bo.office_key
        WHERE bo.brother_id = b.id
          AND bo.start_date <= CURRENT_DATE
          AND (bo.end_date IS NULL OR bo.end_date >= CURRENT_DATE)
        ),
        '[]'::json
      ) AS current_offices
    FROM brothers b
    ORDER BY b.last_name ASC
  `);
  res.status(200).json(rows);
}

async function createBrother(req, res) {
  const payload = brotherSchema.parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertBrother = await client.query(
      "INSERT INTO brothers (last_name, first_name, email, phone, pledge_class, graduation, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [
        payload.last_name,
        payload.first_name,
        payload.email ?? null,
        payload.phone ?? null,
        payload.pledge_class ?? null,
        payload.graduation ?? null,
        payload.status ?? null,
      ]
    );
    const brother = insertBrother.rows[0];

    await client.query("COMMIT");
    res.status(201).json(brother);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function updateBrother(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = brotherSchema.parse(req.body);

  const result = await pool.query(
    "UPDATE brothers SET last_name = $1, first_name = $2, email = $3, phone = $4, pledge_class = $5, graduation = $6, status = $7 WHERE id = $8 RETURNING *",
    [
      payload.last_name,
      payload.first_name,
      payload.email ?? null,
      payload.phone ?? null,
      payload.pledge_class ?? null,
      payload.graduation ?? null,
      payload.status ?? null,
      id,
    ]
  );

  const updated = result.rows[0];
  if (!updated) {
    return res.status(404).json({ error: { message: "Brother not found" } });
  }

  return res.status(200).json(updated);
}

async function deleteBrother(req, res) {
  const { id } = idParamSchema.parse(req.params);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("DELETE FROM brothers WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: { message: "Brother not found" } });
    }
    await client.query("COMMIT");
    return res.status(204).send();
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function brotherStatement(req, res) {
  const { id } = idParamSchema.parse(req.params);
  // "year" is the school-year start (e.g. 2024 => 2024-2025)
  const year = req.query.year ? Number(req.query.year) : currentSchoolYearStart();

  const brotherRes = await pool.query("SELECT * FROM brothers WHERE id = $1", [
    id,
  ]);
  const brother = brotherRes.rows[0];
  if (!brother) {
    return res.status(404).json({ error: { message: "Brother not found" } });
  }

  const paymentsRes = await pool.query(
    "SELECT * FROM dues_payments WHERE brother_id = $1 AND dues_year = $2 ORDER BY paid_at DESC, id DESC",
    [id, year]
  );

  const totalPaidRes = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) as total_paid FROM dues_payments WHERE brother_id = $1 AND dues_year = $2",
    [id, year]
  );

  const planRes = await pool.query("SELECT * FROM dues_plans WHERE year = $1", [year]);
  const plan = planRes.rows[0] ?? null;
  // Prefer category-based plans for statements
  const catPlansRes = await pool.query(
    "SELECT year, category, total_amount FROM dues_plan_categories WHERE year = $1",
    [year]
  );
  const catPlans = Object.fromEntries(catPlansRes.rows.map((r) => [r.category, r]));
  const category = duesCategoryForBrother(brother.pledge_class, year);
  const catInstRes = await pool.query(
    "SELECT id, category, label, due_date, amount FROM dues_plan_category_instalments WHERE year = $1 AND category = $2 ORDER BY due_date ASC, id ASC",
    [year, category]
  );
  const chosenPlan = catPlans[category]
    ? {
        category,
        total_amount: catPlans[category].total_amount,
        instalments: catInstRes.rows,
      }
    : null;
  const legacyInstRes = plan
    ? await pool.query(
        "SELECT id, label, due_date, amount FROM dues_plan_instalments WHERE year = $1 ORDER BY due_date ASC, id ASC",
        [year]
      )
    : { rows: [] };

  return res.status(200).json({
    brother,
    year,
    dues_category: category,
    config: chosenPlan
      ? chosenPlan
      : plan
        ? { year: plan.year, total_amount: plan.total_amount, instalments: legacyInstRes.rows }
        : null,
    totals: { total_paid: totalPaidRes.rows[0]?.total_paid ?? 0 },
    payments: paymentsRes.rows,
  });
}

module.exports = {
  listBrothers,
  createBrother,
  updateBrother,
  deleteBrother,
  brotherStatement,
};



