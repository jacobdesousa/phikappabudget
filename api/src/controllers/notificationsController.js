const { pool } = require("../db/pool");
const { loadAuthContext } = require("../middleware/auth");

async function getNotifications(req, res) {
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });

  const brotherId = ctx.brother_id ?? null;

  const [workdaysRes, shiftsRes, meetingsRes] = await Promise.all([
    pool.query(
      `SELECT id, workday_date, title FROM workdays
       WHERE workday_date >= CURRENT_DATE AND workday_date <= CURRENT_DATE + INTERVAL '60 days'
       ORDER BY workday_date LIMIT 15`
    ),
    pool.query(
      `SELECT id, shift_type, event_date, title FROM shift_events
       WHERE event_date >= CURRENT_DATE AND event_date <= CURRENT_DATE + INTERVAL '60 days'
       ORDER BY event_date LIMIT 30`
    ),
    pool.query(
      `SELECT id, meeting_date, title FROM meeting_minutes
       WHERE meeting_date >= CURRENT_DATE AND meeting_date <= CURRENT_DATE + INTERVAL '60 days'
       ORDER BY meeting_date LIMIT 10`
    ),
  ]);

  let workday_makeups = [];
  let shift_makeups = [];

  if (brotherId) {
    const [wm, sm] = await Promise.all([
      pool.query(
        `SELECT w.id, w.workday_date, w.title, wa.status
         FROM workday_attendance wa
         JOIN workdays w ON w.id = wa.workday_id
         WHERE wa.brother_id = $1
           AND wa.status IN ('Missing', 'Absent')
           AND wa.makeup_completed_at IS NULL
         ORDER BY w.workday_date DESC LIMIT 20`,
        [brotherId]
      ),
      pool.query(
        `SELECT se.id, se.event_date, se.shift_type, se.title, sa.status
         FROM shift_assignments sa
         JOIN shift_events se ON se.id = sa.shift_event_id
         WHERE sa.brother_id = $1
           AND sa.status = 'absent'
           AND sa.makeup_completed_at IS NULL
         ORDER BY se.event_date DESC LIMIT 20`,
        [brotherId]
      ),
    ]);
    workday_makeups = wm.rows;
    shift_makeups = sm.rows;
  }

  return res.json({
    upcoming_workdays: workdaysRes.rows,
    upcoming_shifts: shiftsRes.rows,
    upcoming_meetings: meetingsRes.rows,
    workday_makeups,
    shift_makeups,
  });
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
