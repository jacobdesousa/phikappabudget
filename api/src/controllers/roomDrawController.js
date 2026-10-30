const { pool } = require("../db/pool");
const { legacyAdjustmentSchema } = require("../validation/roomDraw");
const { idParamSchema } = require("../validation/common");
const { computeStandings } = require("../services/roomDrawStandings");

// The standings computation lives in services/roomDrawStandings so the account
// page can show a brother their own points without the roomDraw.read gate.
async function getStandings(req, res) {
  return res.json(await computeStandings());
}

async function getLegacyAdjustments(req, res) {
  const { rows } = await pool.query(
    `SELECT rdlp.id, rdlp.brother_id, b.first_name, b.last_name,
            rdlp.points, rdlp.reason, rdlp.created_at
     FROM room_draw_legacy_points rdlp
     JOIN brothers b ON b.id = rdlp.brother_id
     ORDER BY b.first_name, b.last_name, rdlp.created_at`
  );
  res.json(rows);
}

async function addLegacyAdjustment(req, res) {
  const payload = legacyAdjustmentSchema.parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO room_draw_legacy_points (brother_id, points, reason, added_by_user_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [payload.brother_id, payload.points, payload.reason, req.auth.userId]
  );
  res.status(201).json(rows[0]);
}

async function deleteLegacyAdjustment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { rowCount } = await pool.query(
    `DELETE FROM room_draw_legacy_points WHERE id = $1`,
    [id]
  );
  if (!rowCount) return res.status(404).json({ error: { message: "Adjustment not found" } });
  res.status(204).send();
}

module.exports = { getStandings, getLegacyAdjustments, addLegacyAdjustment, deleteLegacyAdjustment };
