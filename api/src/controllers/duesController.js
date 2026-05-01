const { pool } = require("../db/pool");
const { duesUpdateSchema } = require("../validation/dues");
const { idParamSchema } = require("../validation/common");

async function listDues(req, res) {
  const { rows } = await pool.query("SELECT * FROM dues ORDER BY id ASC");
  res.status(200).json(rows);
}

async function updateDues(req, res) {
  const payload = duesUpdateSchema.parse(req.body);

  const result = await pool.query(
    "UPDATE dues SET first_instalment_date = $1, first_instalment_amount = $2, second_instalment_date = $3, second_instalment_amount = $4, third_instalment_date = $5, third_instalment_amount = $6, fourth_instalment_date = $7, fourth_instalment_amount = $8 WHERE id = $9 RETURNING *",
    [
      payload.first_instalment_date ?? null,
      payload.first_instalment_amount ?? 0,
      payload.second_instalment_date ?? null,
      payload.second_instalment_amount ?? 0,
      payload.third_instalment_date ?? null,
      payload.third_instalment_amount ?? 0,
      payload.fourth_instalment_date ?? null,
      payload.fourth_instalment_amount ?? 0,
      payload.id,
    ]
  );

  const updated = result.rows[0];
  if (!updated) {
    return res.status(404).json({ error: { message: "Dues record not found" } });
  }

  return res.status(200).json(updated);
}

async function updateDuesById(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = duesUpdateSchema.omit({ id: true }).partial().parse(req.body);

  const current = await pool.query("SELECT * FROM dues WHERE id = $1", [id]);
  if (!current.rows[0]) {
    return res.status(404).json({ error: { message: "Dues record not found" } });
  }

  const merged = { ...current.rows[0], ...payload, id };
  const validated = duesUpdateSchema.parse(merged);

  req.body = validated;
  return updateDues(req, res);
}

module.exports = { listDues, updateDues, updateDuesById };



