const { pool } = require("../db/pool");
const { loadAuthContext } = require("../middleware/auth");

async function getNotifications(req, res) {
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

async function getAllMakeups(req, res) {
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });

  const [wm, sm] = await Promise.all([
    pool.query(
      `SELECT w.id AS workday_id, w.workday_date, w.title,
              wa.brother_id, b.first_name, b.last_name, wa.status
       FROM workday_attendance wa
       JOIN workdays w ON w.id = wa.workday_id
       JOIN brothers b ON b.id = wa.brother_id
       WHERE wa.status IN ('Missing', 'Absent')
         AND wa.makeup_completed_at IS NULL
       ORDER BY b.last_name, b.first_name, w.workday_date DESC
       LIMIT 200`
    ),
    pool.query(
      `SELECT se.id AS shift_id, se.event_date, se.shift_type, se.title,
              sa.brother_id, b.first_name, b.last_name, sa.status
       FROM shift_assignments sa
       JOIN shift_events se ON se.id = sa.shift_event_id
       JOIN brothers b ON b.id = sa.brother_id
       WHERE sa.status = 'absent'
         AND sa.makeup_completed_at IS NULL
       ORDER BY b.last_name, b.first_name, se.event_date DESC
       LIMIT 200`
    ),
  ]);

  return res.json({
    workday_makeups: wm.rows,
    shift_makeups: sm.rows,
  });
}

module.exports = { getNotifications, getAllMakeups };
