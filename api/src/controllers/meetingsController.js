const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { meetingUpsertSchema } = require("../validation/meetings");
const { schoolYearStartForDate } = require("../utils/schoolYear");

async function listMeetings(req, res) {
  const { rows } = await pool.query(
    "SELECT id, meeting_date, title, school_year, created_at, updated_at FROM meeting_minutes ORDER BY meeting_date DESC, id DESC"
  );
  return res.status(200).json(rows);
}

async function getMeeting(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const minutesRes = await pool.query(
    `
      SELECT
        id,
        meeting_date,
        title,
        school_year,
        communications,
        old_business,
        new_business,
        betterment,
        motion_accept_moved_by_brother_id,
        motion_accept_seconded_by_brother_id,
        motion_end_moved_by_brother_id,
        motion_end_seconded_by_brother_id,
        created_at,
        updated_at
      FROM meeting_minutes
      WHERE id = $1
    `,
    [id]
  );
  const meeting = minutesRes.rows[0];
  if (!meeting) {
    return res.status(404).json({ error: { message: "Meeting not found" } });
  }

  const attendanceRes = await pool.query(
    `
      SELECT
        a.id,
        a.meeting_id,
        a.brother_id,
        a.member_name,
        a.status,
        a.late_arrival_time,
        a.excused_reason,
        b.first_name,
        b.last_name
      FROM meeting_attendance a
      LEFT JOIN brothers b ON b.id = a.brother_id
      WHERE a.meeting_id = $1
      ORDER BY b.last_name NULLS LAST, b.first_name NULLS LAST, a.member_name NULLS LAST, a.id ASC
    `,
    [id]
  );

  const notesRes = await pool.query(
    `
      SELECT id, meeting_id, officer_key, notes
      FROM meeting_officer_notes
      WHERE meeting_id = $1
      ORDER BY officer_key ASC, id ASC
    `,
    [id]
  );

  return res.status(200).json({
    ...meeting,
    attendance: attendanceRes.rows,
    officer_notes: notesRes.rows,
  });
}

async function createMeeting(req, res) {
  const payload = meetingUpsertSchema.parse(req.body);
  const meetingDate = payload.meeting_date;
  const schoolYear = schoolYearStartForDate(meetingDate);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const meetingRes = await client.query(
      `
        INSERT INTO meeting_minutes (
          meeting_date,
          title,
          school_year,
          communications,
          old_business,
          new_business,
          betterment,
          motion_accept_moved_by_brother_id,
          motion_accept_seconded_by_brother_id,
          motion_end_moved_by_brother_id,
          motion_end_seconded_by_brother_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `,
      [
        meetingDate,
        payload.title ?? null,
        schoolYear,
        payload.communications ?? null,
        payload.old_business ?? null,
        payload.new_business ?? null,
        payload.betterment ?? null,
        payload.motion_accept_moved_by_brother_id ?? null,
        payload.motion_accept_seconded_by_brother_id ?? null,
        payload.motion_end_moved_by_brother_id ?? null,
        payload.motion_end_seconded_by_brother_id ?? null,
      ]
    );
    const meeting = meetingRes.rows[0];

    for (const row of payload.attendance ?? []) {
      await client.query(
        `
          INSERT INTO meeting_attendance (meeting_id, brother_id, member_name, status, late_arrival_time, excused_reason)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          meeting.id,
          row.brother_id ?? null,
          row.member_name ?? null,
          row.status,
          row.late_arrival_time ?? null,
          row.excused_reason ?? null,
        ]
      );
    }

    for (const note of payload.officer_notes ?? []) {
      await client.query(
        `
          INSERT INTO meeting_officer_notes (meeting_id, officer_key, notes)
          VALUES ($1, $2, $3)
        `,
        [meeting.id, note.officer_key, note.notes ?? null]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({ id: meeting.id });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function updateMeeting(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = meetingUpsertSchema.parse(req.body);
  const meetingDate = payload.meeting_date;
  const schoolYear = schoolYearStartForDate(meetingDate);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingRes = await client.query("SELECT * FROM meeting_minutes WHERE id = $1", [id]);
    if (!existingRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: { message: "Meeting not found" } });
    }

    await client.query(
      `
        UPDATE meeting_minutes
        SET meeting_date = $1,
            title = $2,
            school_year = $3,
            communications = $4,
            old_business = $5,
            new_business = $6,
            betterment = $7,
            motion_accept_moved_by_brother_id = $8,
            motion_accept_seconded_by_brother_id = $9,
            motion_end_moved_by_brother_id = $10,
            motion_end_seconded_by_brother_id = $11,
            updated_at = NOW()
        WHERE id = $12
      `,
      [
        meetingDate,
        payload.title ?? null,
        schoolYear,
        payload.communications ?? null,
        payload.old_business ?? null,
        payload.new_business ?? null,
        payload.betterment ?? null,
        payload.motion_accept_moved_by_brother_id ?? null,
        payload.motion_accept_seconded_by_brother_id ?? null,
        payload.motion_end_moved_by_brother_id ?? null,
        payload.motion_end_seconded_by_brother_id ?? null,
        id,
      ]
    );

    await client.query("DELETE FROM meeting_attendance WHERE meeting_id = $1", [id]);
    await client.query("DELETE FROM meeting_officer_notes WHERE meeting_id = $1", [id]);

    for (const row of payload.attendance ?? []) {
      await client.query(
        `
          INSERT INTO meeting_attendance (meeting_id, brother_id, member_name, status, late_arrival_time, excused_reason)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [id, row.brother_id ?? null, row.member_name ?? null, row.status, row.late_arrival_time ?? null, row.excused_reason ?? null]
      );
    }

    for (const note of payload.officer_notes ?? []) {
      await client.query(
        `
          INSERT INTO meeting_officer_notes (meeting_id, officer_key, notes)
          VALUES ($1, $2, $3)
        `,
        [id, note.officer_key, note.notes ?? null]
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function deleteMeeting(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const result = await pool.query("DELETE FROM meeting_minutes WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: { message: "Meeting not found" } });
  }
  return res.status(204).send();
}

module.exports = { listMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting };


