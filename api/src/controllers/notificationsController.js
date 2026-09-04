const { pool } = require("../db/pool");

async function getNotifications(req, res) {
  const { loadAuthContext } = require("../middleware/auth");
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });

  const brotherId = ctx.brother_id ?? null;

  let upcoming_shifts = [];
  if (brotherId) {
    const shiftsRes = await pool.query(
      `SELECT DISTINCT se.id, se.shift_type, se.event_date, se.title
       FROM shift_events se
       WHERE se.event_date >= CURRENT_DATE
         AND se.event_date <= CURRENT_DATE + INTERVAL '60 days'
         AND (
           EXISTS (
             SELECT 1 FROM shift_assignments sa
             WHERE sa.shift_event_id = se.id AND sa.brother_id = $1
           )
           OR EXISTS (
             SELECT 1 FROM shift_party_slots sps
             WHERE sps.shift_event_id = se.id AND sps.brother_id = $1
           )
         )
       ORDER BY se.event_date LIMIT 30`,
      [brotherId]
    );
    upcoming_shifts = shiftsRes.rows;
  }

  return res.json({ upcoming_shifts });
}

module.exports = { getNotifications };
