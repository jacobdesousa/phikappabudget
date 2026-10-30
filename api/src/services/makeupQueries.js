const { pool } = require("../db/pool");

// Absences that call for a makeup. Workdays treat Excused the same as Missing —
// the brother still owes the time — which is what the workday page's own makeup
// field keys off.
const WORKDAY_MAKEUP_STATUSES = ["Missing", "Excused"];

/**
 * Outstanding makeups from all three sources.
 *
 * The date bound is part of the definition rather than a filter the caller
 * picks: nothing is owed until the event has happened, so a roster filled in
 * ahead of next week's workday is a plan, not a list of absences.
 *
 * Pass `brotherIds` for the personal feed; omit it for the chapter-wide list.
 */
async function loadOutstandingMakeups({ asOf, brotherIds = null }) {
  const scoped = (values) => {
    if (!brotherIds) return { clause: "", values };
    values.push(brotherIds);
    return { clause: `AND brother_id = ANY($${values.length}::int[])`, values };
  };

  const wdValues = [WORKDAY_MAKEUP_STATUSES, asOf];
  const wd = scoped(wdValues);
  const shValues = [asOf];
  const sh = scoped(shValues);
  const ptValues = [asOf];
  const pt = scoped(ptValues);

  const [workday, shift, party] = await Promise.all([
    pool.query(
      `SELECT wa.id, w.id AS workday_id, w.workday_date::text AS workday_date, w.title,
              wa.brother_id, wa.status, wa.makeup_assignment
       FROM workday_attendance wa
       JOIN workdays w ON w.id = wa.workday_id
       WHERE wa.status = ANY($1::text[])
         AND w.workday_date <= $2::date
         AND wa.makeup_completed_at IS NULL
         ${wd.clause.replace("brother_id", "wa.brother_id")}
       ORDER BY w.workday_date DESC`,
      wd.values
    ),
    pool.query(
      `SELECT sa.id, se.id AS shift_id, se.event_date::text AS event_date, se.shift_type, se.title,
              sa.brother_id, sa.status, sa.makeup_assignment
       FROM shift_assignments sa
       JOIN shift_events se ON se.id = sa.shift_event_id
       WHERE sa.status = 'absent'
         AND se.event_date <= $1::date
         AND sa.makeup_completed_at IS NULL
         ${sh.clause.replace("brother_id", "sa.brother_id")}
       ORDER BY se.event_date DESC`,
      sh.values
    ),
    pool.query(
      `SELECT sps.id, se.id AS shift_id, se.event_date::text AS event_date, se.shift_type, se.title,
              spd.name AS duty_name, sps.slot_start,
              sps.brother_id, sps.status, sps.makeup_assignment
       FROM shift_party_slots sps
       JOIN shift_events se ON se.id = sps.shift_event_id
       JOIN shift_party_duties spd ON spd.id = sps.duty_id
       WHERE sps.status = 'absent'
         AND se.event_date <= $1::date
         AND sps.makeup_completed_at IS NULL
         ${pt.clause.replace("brother_id", "sps.brother_id")}
       ORDER BY se.event_date DESC`,
      pt.values
    ),
  ]);

  return { workday: workday.rows, shift: shift.rows, party: party.rows };
}

module.exports = { loadOutstandingMakeups, WORKDAY_MAKEUP_STATUSES };
