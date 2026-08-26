const { pool } = require("../db/pool");
const { brotherSchema, ADDRESS_FIELDS } = require("../validation/brothers");
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
      ) AS current_offices,
      -- Every term ever held, current ones included. The roster is small enough
      -- that shipping the history with the list beats a fetch per row when a
      -- detail panel is opened.
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
        ),
        '[]'::json
      ) AS office_history
    FROM brothers b
    ORDER BY b.first_name ASC
  `);
  res.status(200).json(rows);
}

async function createBrother(req, res) {
  const payload = brotherSchema.parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertBrother = await client.query(
      `INSERT INTO brothers
         (last_name, first_name, email, phone, pledge_class, graduation, status,
          alumni_date,
          email_secondary, address_line1, address_line2, city, province, postal_code, country)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        payload.last_name,
        payload.first_name,
        payload.email ?? null,
        payload.phone ?? null,
        payload.pledge_class ?? null,
        payload.graduation ?? null,
        payload.status ?? null,
        // Only an explicit date on create. Someone entered straight in as an
        // alumnus has no known departure date, and inventing today's would
        // wrongly credit him with the current year's membership.
        payload.alumni_date ?? null,
        ...ADDRESS_FIELDS.map((f) => payload[f] ?? null),
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

  const existingRes = await pool.query(
    "SELECT status, alumni_date FROM brothers WHERE id = $1",
    [id]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Brother not found" } });
  }

  // The status change IS the event, so stamp the date here rather than asking
  // anyone to remember to enter it. Any move off Active ends membership —
  // Alumnus, Chapter Eternal, Surrendered and the rest all count, so this keys
  // off leaving 'Active' rather than naming one destination status.
  //
  // An explicit date always wins, so a back-dated correction sticks. An
  // existing date is kept rather than refreshed, so editing an alumnus's phone
  // number doesn't move his departure to today. Returning to Active clears it —
  // otherwise a brother graduated by mistake would keep a date he never had.
  const leftActive = payload.status !== "Active";
  const alumniDate =
    payload.alumni_date !== undefined
      ? payload.alumni_date
      : leftActive
        ? (existing.alumni_date ?? new Date())
        : null;

  const result = await pool.query(
    `UPDATE brothers SET
       last_name = $1, first_name = $2, email = $3, phone = $4, pledge_class = $5,
       graduation = $6, status = $7, alumni_date = $8,
       email_secondary = $9, address_line1 = $10, address_line2 = $11, city = $12,
       province = $13, postal_code = $14, country = $15
     WHERE id = $16 RETURNING *`,
    [
      payload.last_name,
      payload.first_name,
      payload.email ?? null,
      payload.phone ?? null,
      payload.pledge_class ?? null,
      payload.graduation ?? null,
      payload.status ?? null,
      alumniDate,
      ...ADDRESS_FIELDS.map((f) => payload[f] ?? null),
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

async function importBrothers(req, res) {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: { message: "rows array required" } });
  }
  if (rows.length > 500) {
    return res.status(400).json({ error: { message: "Max 500 rows per import" } });
  }

  const inserted = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const parse = brotherSchema.safeParse(rows[i]);
    if (!parse.success) {
      errors.push({ row: i + 1, message: parse.error.issues.map((e) => e.message).join("; ") });
      continue;
    }
    const p = parse.data;
    try {
      const r = await pool.query(
        "INSERT INTO brothers (last_name, first_name, email, phone, pledge_class, graduation, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
        [p.last_name, p.first_name, p.email ?? null, p.phone ?? null, p.pledge_class ?? null, p.graduation ?? null, p.status ?? null]
      );
      inserted.push(r.rows[0].id);
    } catch (e) {
      errors.push({ row: i + 1, message: e.message });
    }
  }

  return res.status(200).json({ inserted: inserted.length, errors });
}

module.exports = {
  listBrothers,
  createBrother,
  updateBrother,
  deleteBrother,
  brotherStatement,
  importBrothers,
};



