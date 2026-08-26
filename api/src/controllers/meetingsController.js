const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { meetingUpsertSchema, emailMinutesSchema } = require("../validation/meetings");
const { schoolYearStartForDate } = require("../utils/schoolYear");
const { sendMail } = require("../utils/mailer");
const { generateMeetingPdf } = require("../utils/pdfGenerator");
const LOGO_URL = "https://uoftskulls.ca/alphabeta.png";

function buildPdfFilename(meeting) {
  const dateStr = new Date(meeting.meeting_date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  }).replace(/,/g, "").replace(/\s+/g, "-");
  const slug = meeting.title?.trim()
    ? "-" + meeting.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
    : "";
  return `minutes-${dateStr}${slug}.pdf`;
}

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

async function emailMeetingMinutes(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const body = emailMinutesSchema.parse(req.body ?? {});
  const customMessage = String(body.custom_message ?? "").trim();
  const senderName = String(body.sender_name ?? "").trim();
  const senderOffice = String(body.sender_office ?? "").trim();
  const recipientIds = body.recipient_brother_ids;

  // Generate PDF (also fetches meeting data)
  let pdfBuffer, meetingData;
  try {
    const result = await generateMeetingPdf(id);
    pdfBuffer = result.pdf;
    meetingData = result.data;
  } catch (e) {
    if (e.message === "Meeting not found") return res.status(404).json({ error: { message: "Meeting not found" } });
    throw e;
  }

  // Alumni records often carry only a secondary address, so fall back to it
  // rather than silently dropping a recipient the sender explicitly picked.
  const EMAIL_EXPR = `COALESCE(NULLIF(TRIM(email), ''), NULLIF(TRIM(email_secondary), ''))`;

  // No explicit list means the old behaviour: every active brother.
  const brothersRes = recipientIds
    ? await pool.query(
        `SELECT ${EMAIL_EXPR} AS email FROM brothers WHERE id = ANY($1::int[]) AND ${EMAIL_EXPR} IS NOT NULL`,
        [recipientIds]
      )
    : await pool.query(
        `SELECT ${EMAIL_EXPR} AS email FROM brothers WHERE status = 'Active' AND ${EMAIL_EXPR} IS NOT NULL`
      );

  // One brother picked twice — as an active and again through the search — must
  // not get two copies.
  const seen = new Set();
  const recipients = [];
  for (const row of brothersRes.rows) {
    const key = row.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(row.email);
  }

  if (recipients.length === 0) {
    return res.status(400).json({
      error: {
        message: recipientIds
          ? "None of the selected brothers have an email address on file."
          : "No active brothers with email addresses found.",
      },
    });
  }

  const { meeting } = meetingData;
  const dateStr = new Date(meeting.meeting_date).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const title = meeting.title?.trim() || `Meeting — ${dateStr}`;
  const filename = buildPdfFilename(meeting);

  function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  const customMessageHtml = customMessage
    ? `<div style="margin:0 0 24px;padding:16px;border-left:3px solid #1a1a2e;font-size:14px;color:#222;white-space:pre-wrap">${esc(customMessage)}</div>`
    : "";

  const sigLine = [senderName, senderOffice].filter(Boolean).join(", ");
  const signatureHtml = sigLine
    ? `<p style="margin:24px 0 0;font-size:13px;color:#555">${esc(sigLine)}<br><span style="color:#888">Phi Kappa Sigma — Alpha Beta</span></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">
    <tr><td style="background:#1a1a2e;padding:20px 32px">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px;vertical-align:middle">
          <img src="${LOGO_URL}" alt="Alpha Beta" width="36" height="36" style="display:block">
        </td>
        <td style="vertical-align:middle">
          <div style="color:#fff;font-size:17px;font-weight:700;letter-spacing:.3px">Phi Kappa Sigma</div>
          <div style="color:#aaa;font-size:12px;margin-top:1px">Alpha Beta Chapter</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px">
      <h2 style="margin:0 0 4px;font-size:18px;color:#111">${esc(title)}</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#888">${dateStr}</p>
      ${customMessageHtml}
      <p style="margin:0;font-size:14px;color:#333">Please find the meeting minutes attached as a PDF.</p>
      ${signatureHtml}
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    title, dateStr, "",
    customMessage ? `${customMessage}\n` : "",
    "Please find the meeting minutes attached as a PDF.",
    senderName ? `\n${senderName}\nPhi Kappa Sigma — Alpha Beta` : "",
  ].join("\n");

  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendMail({
        to,
        subject: `Meeting Minutes — ${dateStr}`,
        html,
        text,
        attachments: [{ filename, content: Buffer.from(pdfBuffer), contentType: "application/pdf" }],
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return res.status(200).json({ ok: true, sent_to: sent, failed });
}

async function downloadMeetingPdf(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { pdf, data } = await generateMeetingPdf(id);
  const filename = buildPdfFilename(data.meeting);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": pdf.length,
  });
  return res.send(Buffer.from(pdf));
}

module.exports = { listMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting, emailMeetingMinutes, downloadMeetingPdf };


