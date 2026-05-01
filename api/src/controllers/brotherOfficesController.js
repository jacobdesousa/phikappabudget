const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { officeAssignSchema, officeUpdateSchema } = require("../validation/brotherOffices");
const { z } = require("zod");

const tenureParamSchema = z.object({ tenureId: z.coerce.number().int().positive() });

async function listBrotherOffices(req, res) {
  const { id: brotherId } = idParamSchema.parse(req.params);
  const { rows } = await pool.query(
    `SELECT bo.id, bo.brother_id, bo.office_key, o.display_name, bo.start_date, bo.end_date, bo.created_at
     FROM brother_offices bo
     JOIN offices o ON o.office_key = bo.office_key
     WHERE bo.brother_id = $1
     ORDER BY bo.start_date DESC, bo.id DESC`,
    [brotherId]
  );
  return res.status(200).json(rows ?? []);
}

async function assignBrotherOffice(req, res) {
  const { id: brotherId } = idParamSchema.parse(req.params);
  const payload = officeAssignSchema.parse(req.body);

  const officeExists = await pool.query(`SELECT 1 FROM offices WHERE office_key = $1 LIMIT 1`, [payload.office_key]);
  if (!officeExists.rows?.[0]) return res.status(400).json({ error: { message: "Office not found." } });

  const brotherExists = await pool.query(`SELECT 1 FROM brothers WHERE id = $1 LIMIT 1`, [brotherId]);
  if (!brotherExists.rows?.[0]) return res.status(404).json({ error: { message: "Brother not found." } });

  const inserted = await pool.query(
    `INSERT INTO brother_offices (brother_id, office_key, start_date, end_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [brotherId, payload.office_key, payload.start_date, payload.end_date ?? null]
  );
  const { rows } = await pool.query(
    `SELECT bo.id, bo.brother_id, bo.office_key, o.display_name, bo.start_date, bo.end_date, bo.created_at
     FROM brother_offices bo JOIN offices o ON o.office_key = bo.office_key
     WHERE bo.id = $1`,
    [inserted.rows[0].id]
  );
  return res.status(201).json(rows[0]);
}

async function updateBrotherOffice(req, res) {
  const { tenureId } = tenureParamSchema.parse(req.params);
  const payload = officeUpdateSchema.parse(req.body);

  const current = await pool.query(`SELECT * FROM brother_offices WHERE id = $1 LIMIT 1`, [tenureId]);
  if (!current.rows?.[0]) return res.status(404).json({ error: { message: "Office tenure not found." } });

  const row = current.rows[0];
  const newStartDate = payload.start_date ?? row.start_date;
  const newEndDate = "end_date" in payload ? (payload.end_date ?? null) : row.end_date;

  await pool.query(
    `UPDATE brother_offices SET start_date = $1, end_date = $2 WHERE id = $3`,
    [newStartDate, newEndDate, tenureId]
  );
  const { rows } = await pool.query(
    `SELECT bo.id, bo.brother_id, bo.office_key, o.display_name, bo.start_date, bo.end_date, bo.created_at
     FROM brother_offices bo JOIN offices o ON o.office_key = bo.office_key
     WHERE bo.id = $1`,
    [tenureId]
  );
  return res.status(200).json(rows[0]);
}

async function deleteBrotherOffice(req, res) {
  const { tenureId } = tenureParamSchema.parse(req.params);
  const deleted = await pool.query(`DELETE FROM brother_offices WHERE id = $1 RETURNING id`, [tenureId]);
  if (!deleted.rows?.[0]) return res.status(404).json({ error: { message: "Office tenure not found." } });
  return res.status(200).json({ ok: true });
}

module.exports = { listBrotherOffices, assignBrotherOffice, updateBrotherOffice, deleteBrotherOffice };
