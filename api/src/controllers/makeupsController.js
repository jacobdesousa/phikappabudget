const { pool } = require("../db/pool");
const { loadAuthContext } = require("../middleware/auth");
const { makeupUpdateSchema } = require("../validation/makeups");

// Completed makeups are kept for reference, not for working through, so the
// list is capped at the most recently completed rather than going back forever.
const COMPLETED_LIMIT = 200;

// Absences that call for a makeup. Workdays treat Excused the same as Missing —
// the brother still owes the time — which is what the workday page's own makeup
// field keys off.
const WORKDAY_MAKEUP_STATUSES = ["Missing", "Excused"];

async function getAllMakeups(req, res) {
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });

  // Each list carries both outstanding and completed rows; the client splits on
  // makeup_completed_at. One query per source beats six.
  const [wm, sm, pm] = await Promise.all([
    pool.query(
      `SELECT wa.id, w.id AS workday_id, w.workday_date, w.title,
              wa.brother_id, b.first_name, b.last_name, wa.status,
              wa.makeup_completed_at, wa.makeup_assignment
       FROM workday_attendance wa
       JOIN workdays w ON w.id = wa.workday_id
       JOIN brothers b ON b.id = wa.brother_id
       WHERE wa.status = ANY($1::text[])
         AND (wa.makeup_completed_at IS NULL OR wa.id IN (
           SELECT id FROM workday_attendance
           WHERE makeup_completed_at IS NOT NULL
           ORDER BY makeup_completed_at DESC LIMIT $2
         ))
       ORDER BY w.workday_date DESC, b.last_name, b.first_name`,
      [WORKDAY_MAKEUP_STATUSES, COMPLETED_LIMIT]
    ),
    pool.query(
      `SELECT sa.id, se.id AS shift_id, se.event_date, se.shift_type, se.title,
              sa.brother_id, b.first_name, b.last_name, sa.status,
              sa.makeup_completed_at, sa.makeup_assignment
       FROM shift_assignments sa
       JOIN shift_events se ON se.id = sa.shift_event_id
       JOIN brothers b ON b.id = sa.brother_id
       WHERE sa.status = 'absent'
         AND (sa.makeup_completed_at IS NULL OR sa.id IN (
           SELECT id FROM shift_assignments
           WHERE makeup_completed_at IS NOT NULL
           ORDER BY makeup_completed_at DESC LIMIT $1
         ))
       ORDER BY se.event_date DESC, b.last_name, b.first_name`,
      [COMPLETED_LIMIT]
    ),
    // Party absences live in the duty slots, not shift_assignments, so they
    // never appeared on this page before.
    pool.query(
      `SELECT sps.id, se.id AS shift_id, se.event_date, se.shift_type, se.title,
              spd.name AS duty_name, sps.slot_start,
              sps.brother_id, b.first_name, b.last_name, sps.status,
              sps.makeup_completed_at, sps.makeup_assignment
       FROM shift_party_slots sps
       JOIN shift_events se ON se.id = sps.shift_event_id
       JOIN shift_party_duties spd ON spd.id = sps.duty_id
       JOIN brothers b ON b.id = sps.brother_id
       WHERE sps.status = 'absent'
         AND (sps.makeup_completed_at IS NULL OR sps.id IN (
           SELECT id FROM shift_party_slots
           WHERE makeup_completed_at IS NOT NULL
           ORDER BY makeup_completed_at DESC LIMIT $1
         ))
       ORDER BY se.event_date DESC, b.last_name, b.first_name`,
      [COMPLETED_LIMIT]
    ),
  ]);

  return res.json({
    workday_makeups: wm.rows,
    // Setup and cleanup. Parties are their own list because they come from a
    // different table and carry a duty and time slot.
    shift_makeups: sm.rows,
    party_makeups: pm.rows,
  });
}

// The three sources, keyed by the `kind` in the URL. Each names the table its
// row lives in and how to find the shift type that gates writing to it.
const SOURCES = {
  workday: { table: "workday_attendance", permission: () => "workdays.write" },
  shift: { table: "shift_assignments", eventJoin: "shift_event_id" },
  party: { table: "shift_party_slots", eventJoin: "shift_event_id" },
};

// Setting a makeup date or writing the assignment, straight from the makeups
// page. Editing these through the workday or shift page still works; this
// exists so chasing down a dozen outstanding makeups does not mean a dozen
// round trips through other pages.
async function updateMakeup(req, res) {
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });

  const kind = String(req.params.kind ?? "");
  const source = SOURCES[kind];
  if (!source) return res.status(400).json({ error: { message: "kind must be workday, shift, or party" } });

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: { message: "Invalid id" } });

  const patch = makeupUpdateSchema.parse(req.body ?? {});
  if (!("makeup_completed_at" in patch) && !("makeup_assignment" in patch)) {
    return res.status(400).json({ error: { message: "Nothing to update" } });
  }

  // A shift row's permission depends on the event's type, so the row has to be
  // read before the write can be authorized.
  let permission;
  if (source.permission) {
    permission = source.permission();
    const exists = await pool.query(`SELECT 1 FROM ${source.table} WHERE id = $1`, [id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: { message: "Makeup not found" } });
  } else {
    const row = await pool.query(
      `SELECT se.shift_type FROM ${source.table} t
       JOIN shift_events se ON se.id = t.${source.eventJoin}
       WHERE t.id = $1`,
      [id]
    );
    if (row.rowCount === 0) return res.status(404).json({ error: { message: "Makeup not found" } });
    permission = `shifts.${row.rows[0].shift_type}.write`;
  }

  if (!ctx.permissions.includes(permission)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const sets = [];
  const values = [id];
  if ("makeup_completed_at" in patch) {
    values.push(patch.makeup_completed_at ?? null);
    sets.push(`makeup_completed_at = $${values.length}`);
  }
  if ("makeup_assignment" in patch) {
    const text = (patch.makeup_assignment ?? "").trim();
    values.push(text || null);
    sets.push(`makeup_assignment = $${values.length}`);
  }

  const { rows } = await pool.query(
    `UPDATE ${source.table} SET ${sets.join(", ")} WHERE id = $1
     RETURNING id, makeup_completed_at, makeup_assignment`,
    values
  );

  return res.json(rows[0]);
}

module.exports = { getAllMakeups, updateMakeup };
