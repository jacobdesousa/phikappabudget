const { pool } = require("../db/pool");
const { loadAuthContext } = require("../middleware/auth");
const { schoolYearStartForDate } = require("../utils/schoolYear");
const { shiftCreateSchema, shiftUpdateSchema, partyDutySchema } = require("../validation/shifts");

// Generate HH:MM slot_start strings from start to end (exclusive), stepping 1 hour.
// Hours may exceed 24 for overnight (e.g. "25:00" = 1am next day).
function generateSlots(startStr, endStr) {
  const parseH = (s) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const fmtH = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  let startMins = parseH(startStr);
  let endMins = parseH(endStr);
  if (endMins <= startMins) endMins += 24 * 60; // midnight wrap
  const slots = [];
  for (let t = startMins; t < endMins; t += 60) {
    slots.push(fmtH(t));
  }
  return slots;
}

async function checkPermission(req, res, permKey) {
  const ctx = await loadAuthContext(req);
  if (!ctx) { res.status(401).json({ error: { message: "Unauthorized" } }); return null; }
  if (!ctx.permissions.includes(permKey)) { res.status(403).json({ error: { message: "Forbidden" } }); return null; }
  return ctx;
}

async function listShifts(req, res) {
  const type = String(req.query.type ?? "");
  if (!["setup", "cleanup", "party"].includes(type)) {
    return res.status(400).json({ error: { message: "type must be setup, cleanup, or party" } });
  }
  const ctx = await checkPermission(req, res, `shifts.${type}.read`);
  if (!ctx) return;

  const schoolYear = req.query.school_year ? Number(req.query.school_year) : schoolYearStartForDate(new Date());

  const { rows } = await pool.query(
    `SELECT se.id, se.shift_type, se.event_date, se.title, se.school_year, se.notes,
            se.party_start_time, se.party_end_time, se.created_at,
            COUNT(sa.id)::int AS assignment_count
     FROM shift_events se
     LEFT JOIN shift_assignments sa ON sa.shift_event_id = se.id
     WHERE se.shift_type = $1 AND se.school_year = $2
     GROUP BY se.id
     ORDER BY se.event_date DESC`,
    [type, schoolYear]
  );
  return res.status(200).json(rows);
}

async function getShift(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: { message: "Invalid shift id" } });

  const eventRes = await pool.query(`SELECT * FROM shift_events WHERE id = $1`, [id]);
  const event = eventRes.rows?.[0];
  if (!event) return res.status(404).json({ error: { message: "Shift not found" } });

  const ctx = await checkPermission(req, res, `shifts.${event.shift_type}.read`);
  if (!ctx) return;

  if (event.shift_type === "party") {
    const dutiesRes = await pool.query(
      `SELECT id, name, display_order FROM shift_party_duties WHERE shift_event_id = $1 ORDER BY display_order ASC, id ASC`,
      [id]
    );
    const slotsRes = await pool.query(
      `SELECT sps.id, sps.duty_id, spd.name AS duty_name, sps.slot_start,
              sps.brother_id, b.first_name, b.last_name, sps.status, sps.makeup_completed_at
       FROM shift_party_slots sps
       JOIN shift_party_duties spd ON spd.id = sps.duty_id
       LEFT JOIN brothers b ON b.id = sps.brother_id
       WHERE sps.shift_event_id = $1
       ORDER BY sps.slot_start ASC, spd.display_order ASC, spd.id ASC`,
      [id]
    );
    return res.status(200).json({ ...event, duties: dutiesRes.rows, slots: slotsRes.rows });
  }

  const assignRes = await pool.query(
    `SELECT sa.id, sa.brother_id, b.first_name, b.last_name, sa.status, sa.makeup_completed_at
     FROM shift_assignments sa
     JOIN brothers b ON b.id = sa.brother_id
     WHERE sa.shift_event_id = $1
     ORDER BY b.last_name ASC, b.first_name ASC`,
    [id]
  );
  return res.status(200).json({ ...event, assignments: assignRes.rows });
}

async function createShift(req, res) {
  const payload = shiftCreateSchema.parse(req.body);
  const ctx = await checkPermission(req, res, `shifts.${payload.shift_type}.write`);
  if (!ctx) return;

  const eventDate = new Date(payload.event_date);
  const schoolYear = schoolYearStartForDate(eventDate);

  if (payload.shift_type === "party") {
    if (!payload.party_start_time || !payload.party_end_time) {
      return res.status(400).json({ error: { message: "party_start_time and party_end_time required for party shifts" } });
    }
    if (!payload.duties || payload.duties.length === 0) {
      return res.status(400).json({ error: { message: "At least one duty is required for party shifts" } });
    }
    const slots = generateSlots(payload.party_start_time, payload.party_end_time);
    if (slots.length === 0) {
      return res.status(400).json({ error: { message: "party_end_time must be after party_start_time" } });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const eventRes = await client.query(
        `INSERT INTO shift_events (shift_type, event_date, title, school_year, notes, party_start_time, party_end_time, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [payload.shift_type, payload.event_date, payload.title ?? null, schoolYear, payload.notes ?? null,
         payload.party_start_time, payload.party_end_time, ctx.id]
      );
      const event = eventRes.rows[0];

      const duties = [];
      for (let i = 0; i < payload.duties.length; i++) {
        const dr = await client.query(
          `INSERT INTO shift_party_duties (shift_event_id, name, display_order) VALUES ($1, $2, $3) RETURNING *`,
          [event.id, payload.duties[i], i]
        );
        duties.push(dr.rows[0]);
      }

      for (const duty of duties) {
        for (const slot of slots) {
          await client.query(
            `INSERT INTO shift_party_slots (shift_event_id, duty_id, slot_start) VALUES ($1, $2, $3)`,
            [event.id, duty.id, slot]
          );
        }
      }

      await client.query("COMMIT");
      return res.status(201).json({ ...event, duties, slots: [] });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Setup / cleanup
  const eventRes = await pool.query(
    `INSERT INTO shift_events (shift_type, event_date, title, school_year, notes, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [payload.shift_type, payload.event_date, payload.title ?? null, schoolYear, payload.notes ?? null, ctx.id]
  );
  return res.status(201).json({ ...eventRes.rows[0], assignments: [] });
}

async function updateShift(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: { message: "Invalid shift id" } });

  const eventRes = await pool.query(`SELECT * FROM shift_events WHERE id = $1`, [id]);
  const event = eventRes.rows?.[0];
  if (!event) return res.status(404).json({ error: { message: "Shift not found" } });

  const ctx = await checkPermission(req, res, `shifts.${event.shift_type}.write`);
  if (!ctx) return;

  const payload = shiftUpdateSchema.parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update metadata
    await client.query(
      `UPDATE shift_events SET
         event_date = COALESCE($1, event_date),
         title = $2,
         notes = $3,
         party_start_time = COALESCE($4, party_start_time),
         party_end_time = COALESCE($5, party_end_time)
       WHERE id = $6`,
      [payload.event_date ?? null, payload.title ?? null, payload.notes ?? null,
       payload.party_start_time ?? null, payload.party_end_time ?? null, id]
    );

    if (event.shift_type === "party" && payload.slots) {
      for (const slot of payload.slots) {
        await client.query(
          `UPDATE shift_party_slots
           SET brother_id = $1, status = $2, makeup_completed_at = $3
           WHERE shift_event_id = $4 AND duty_id = $5 AND slot_start = $6`,
          [slot.brother_id ?? null, slot.status, slot.makeup_completed_at ?? null, id, slot.duty_id, slot.slot_start]
        );
      }
    } else if (payload.assignments) {
      // Delete removed assignments
      const keepIds = payload.assignments.map((a) => a.brother_id);
      if (keepIds.length > 0) {
        await client.query(
          `DELETE FROM shift_assignments WHERE shift_event_id = $1 AND brother_id <> ALL($2::int[])`,
          [id, keepIds]
        );
      } else {
        await client.query(`DELETE FROM shift_assignments WHERE shift_event_id = $1`, [id]);
      }

      for (const a of payload.assignments) {
        await client.query(
          `INSERT INTO shift_assignments (shift_event_id, brother_id, status, makeup_completed_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (shift_event_id, brother_id)
           DO UPDATE SET status = EXCLUDED.status, makeup_completed_at = EXCLUDED.makeup_completed_at`,
          [id, a.brother_id, a.status, a.makeup_completed_at ?? null]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return getShift(req, res);
}

async function deleteShift(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: { message: "Invalid shift id" } });

  const eventRes = await pool.query(`SELECT shift_type FROM shift_events WHERE id = $1`, [id]);
  const event = eventRes.rows?.[0];
  if (!event) return res.status(404).json({ error: { message: "Shift not found" } });

  const ctx = await checkPermission(req, res, `shifts.${event.shift_type}.write`);
  if (!ctx) return;

  await pool.query(`DELETE FROM shift_events WHERE id = $1`, [id]);
  return res.status(200).json({ ok: true });
}

async function getBrotherCounts(req, res) {
  const type = String(req.query.type ?? "");
  if (!["setup", "cleanup", "party"].includes(type)) {
    return res.status(400).json({ error: { message: "type must be setup, cleanup, or party" } });
  }
  const ctx = await checkPermission(req, res, `shifts.${type}.read`);
  if (!ctx) return;

  const schoolYear = req.query.school_year ? Number(req.query.school_year) : schoolYearStartForDate(new Date());

  if (type === "party") {
    const { rows } = await pool.query(
      `SELECT b.id AS brother_id, b.first_name, b.last_name,
              COUNT(sps.id)::int AS count
       FROM brothers b
       LEFT JOIN shift_party_slots sps ON sps.brother_id = b.id
         AND sps.shift_event_id IN (
           SELECT id FROM shift_events WHERE shift_type = 'party' AND school_year = $1
         )
       WHERE b.status IN ('Active', 'Pledge')
       GROUP BY b.id, b.first_name, b.last_name
       ORDER BY count ASC, b.last_name ASC, b.first_name ASC`,
      [schoolYear]
    );
    return res.status(200).json(rows);
  }

  const { rows } = await pool.query(
    `SELECT b.id AS brother_id, b.first_name, b.last_name,
            COUNT(sa.id)::int AS count
     FROM brothers b
     LEFT JOIN shift_assignments sa ON sa.brother_id = b.id
       AND sa.shift_event_id IN (
         SELECT id FROM shift_events WHERE shift_type = $1 AND school_year = $2
       )
     WHERE b.status IN ('Active', 'Pledge')
     GROUP BY b.id, b.first_name, b.last_name
     ORDER BY count ASC, b.last_name ASC, b.first_name ASC`,
    [type, schoolYear]
  );
  return res.status(200).json(rows);
}

async function listPartyDuties(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: { message: "Invalid shift id" } });

  const ctx = await checkPermission(req, res, "shifts.party.read");
  if (!ctx) return;

  const { rows } = await pool.query(
    `SELECT id, name, display_order FROM shift_party_duties WHERE shift_event_id = $1 ORDER BY display_order ASC, id ASC`,
    [id]
  );
  return res.status(200).json(rows);
}

async function createPartyDuty(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: { message: "Invalid shift id" } });

  const ctx = await checkPermission(req, res, "shifts.party.write");
  if (!ctx) return;

  const payload = partyDutySchema.parse(req.body);

  // Get event to find time range for auto-generating slots
  const eventRes = await pool.query(`SELECT party_start_time, party_end_time FROM shift_events WHERE id = $1`, [id]);
  const event = eventRes.rows?.[0];
  if (!event) return res.status(404).json({ error: { message: "Shift not found" } });

  const maxOrderRes = await pool.query(
    `SELECT COALESCE(MAX(display_order), -1)::int AS max_order FROM shift_party_duties WHERE shift_event_id = $1`,
    [id]
  );
  const nextOrder = (maxOrderRes.rows[0]?.max_order ?? -1) + 1;
  const order = payload.display_order ?? nextOrder;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const dutyRes = await client.query(
      `INSERT INTO shift_party_duties (shift_event_id, name, display_order) VALUES ($1, $2, $3) RETURNING *`,
      [id, payload.name, order]
    );
    const duty = dutyRes.rows[0];

    // Auto-generate slots for this new duty over the existing time range
    if (event.party_start_time && event.party_end_time) {
      const slots = generateSlots(event.party_start_time, event.party_end_time);
      for (const slot of slots) {
        await client.query(
          `INSERT INTO shift_party_slots (shift_event_id, duty_id, slot_start) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [id, duty.id, slot]
        );
      }
    }

    await client.query("COMMIT");
    return res.status(201).json(duty);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updatePartyDuty(req, res) {
  const dutyId = Number(req.params.dutyId);
  if (!Number.isFinite(dutyId) || dutyId <= 0) return res.status(400).json({ error: { message: "Invalid duty id" } });

  const ctx = await checkPermission(req, res, "shifts.party.write");
  if (!ctx) return;

  const payload = partyDutySchema.parse(req.body);

  const result = await pool.query(
    `UPDATE shift_party_duties SET name = $1, display_order = COALESCE($2, display_order) WHERE id = $3 RETURNING *`,
    [payload.name, payload.display_order ?? null, dutyId]
  );
  if (!result.rows?.[0]) return res.status(404).json({ error: { message: "Duty not found" } });
  return res.status(200).json(result.rows[0]);
}

async function deletePartyDuty(req, res) {
  const dutyId = Number(req.params.dutyId);
  if (!Number.isFinite(dutyId) || dutyId <= 0) return res.status(400).json({ error: { message: "Invalid duty id" } });

  const ctx = await checkPermission(req, res, "shifts.party.write");
  if (!ctx) return;

  const result = await pool.query(`DELETE FROM shift_party_duties WHERE id = $1 RETURNING id`, [dutyId]);
  if (!result.rows?.[0]) return res.status(404).json({ error: { message: "Duty not found" } });
  return res.status(200).json({ ok: true });
}

module.exports = {
  listShifts, getShift, createShift, updateShift, deleteShift,
  getBrotherCounts, listPartyDuties, createPartyDuty, updatePartyDuty, deletePartyDuty,
};
