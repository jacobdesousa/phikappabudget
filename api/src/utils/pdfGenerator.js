const { pool } = require("../db/pool");
const { logoDataUrl } = require("../assets/logoBase64");

async function fetchMeetingForPdf(meetingId) {
  const [meetingRes, attendanceRes, notesRes, votesRes] = await Promise.all([
    pool.query(
      `SELECT m.id, m.meeting_date, m.title, m.school_year,
              m.communications, m.old_business, m.new_business, m.betterment,
              m.motion_accept_moved_by_brother_id, m.motion_accept_seconded_by_brother_id,
              m.motion_end_moved_by_brother_id, m.motion_end_seconded_by_brother_id
       FROM meeting_minutes m WHERE m.id = $1`,
      [meetingId]
    ),
    pool.query(
      `SELECT a.id, a.brother_id, a.member_name, a.status, a.late_arrival_time, a.excused_reason,
              b.first_name, b.last_name
       FROM meeting_attendance a
       LEFT JOIN brothers b ON b.id = a.brother_id
       WHERE a.meeting_id = $1
       ORDER BY b.last_name NULLS LAST, b.first_name NULLS LAST, a.member_name NULLS LAST`,
      [meetingId]
    ),
    pool.query(
      `SELECT officer_key, notes FROM meeting_officer_notes WHERE meeting_id = $1 AND notes <> '' ORDER BY officer_key`,
      [meetingId]
    ),
    pool.query(
      `SELECT v.id, v.question, v.is_anonymous, v.closed_at, v.results_visible
       FROM meeting_votes v WHERE v.meeting_id = $1 ORDER BY v.id`,
      [meetingId]
    ),
  ]);

  const meeting = meetingRes.rows[0];
  if (!meeting) return null;

  const voteDetails = await Promise.all(
    votesRes.rows.map(async (v) => {
      const [optRes, voterRes] = await Promise.all([
        pool.query(
          `SELECT o.id, o.option_text, COUNT(s.id)::int AS count
           FROM meeting_vote_options o
           LEFT JOIN meeting_vote_response_selections s ON s.option_id = o.id
           WHERE o.vote_id = $1 GROUP BY o.id ORDER BY o.display_order, o.id`,
          [v.id]
        ),
        v.is_anonymous
          ? Promise.resolve({ rows: [] })
          : pool.query(
              `SELECT s.option_id, b.first_name, b.last_name
               FROM meeting_vote_response_selections s
               JOIN meeting_vote_responses r ON r.id = s.response_id
               JOIN users u ON u.id = r.user_id
               LEFT JOIN brothers b ON b.id = u.brother_id
               WHERE r.vote_id = $1`,
              [v.id]
            ),
      ]);
      return { ...v, options: optRes.rows, voters: voterRes.rows };
    })
  );

  const brotherIds = [
    meeting.motion_accept_moved_by_brother_id,
    meeting.motion_accept_seconded_by_brother_id,
    meeting.motion_end_moved_by_brother_id,
    meeting.motion_end_seconded_by_brother_id,
  ].filter(Boolean);

  const nameMap = new Map();
  if (brotherIds.length > 0) {
    const bRes = await pool.query(
      `SELECT id, first_name, last_name FROM brothers WHERE id = ANY($1)`,
      [brotherIds]
    );
    for (const b of bRes.rows) nameMap.set(b.id, `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim());
  }

  return { meeting, attendance: attendanceRes.rows, officer_notes: notesRes.rows, votes: voteDetails, nameMap };
}

function esc(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const OFFICER_LABELS = {
  alpha: "Alpha", beta: "Beta", pi: "Pi", sigma: "Sigma", tau: "Tau",
  chi: "Chi", gamma: "Gamma", psi: "Psi", theta: "Theta", iota: "Iota",
  upsilon: "Upsilon", phi: "Phi", omega: "Omega", rho: "Rho",
  omicron: "Omicron", zeta: "Zeta",
};

function buildPdfHtml(data) {
  const { meeting, attendance, officer_notes, votes, nameMap } = data;

  const dateStr = new Date(meeting.meeting_date).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const name = (id) => (id ? nameMap.get(id) ?? "________" : "________");
  const body = (text) => esc(text?.trim() || "—"); // em dash fallback

  const attendanceHtml = attendance.map((r) => {
    const memberName = r.brother_id
      ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
      : r.member_name ?? "";
    let detail = "—";
    if (r.status === "Late" && r.late_arrival_time) detail = `Arrived ${formatTime(r.late_arrival_time)}`;
    else if (r.status === "Excused" && r.excused_reason) detail = esc(r.excused_reason);
    return `<tr><td>${esc(memberName)}</td><td>${esc(r.status)}</td><td>${detail}</td></tr>`;
  }).join("");

  const officerHtml = officer_notes.map((n) => `
    <div class="officer-block">
      <div class="officer-key">${esc(OFFICER_LABELS[n.officer_key?.toLowerCase()] ?? n.officer_key)}</div>
      <div class="pre">${esc(n.notes)}</div>
    </div>`).join("");

  const votesHtml = votes.length === 0 ? "" : `
    <div class="section-title">Votes</div>
    ${votes.map((v) => {
      const totalVotes = v.options.reduce((s, o) => s + o.count, 0);
      const optRows = v.options.map((opt) => {
        const voterNames = v.is_anonymous ? "" : v.voters
          .filter((r) => r.option_id === opt.id)
          .map((r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim())
          .join(", ") || "—";
        return `<tr>
          <td>${esc(opt.option_text)}</td>
          <td style="text-align:right">${opt.count}</td>
          ${!v.is_anonymous ? `<td>${voterNames}</td>` : ""}
        </tr>`;
      }).join("");
      return `
        <div style="margin-top:12px">
          <div style="font-weight:700;font-size:13px">${esc(v.question)}${v.is_anonymous ? " (Secret vote)" : ""} · ${totalVotes} response${totalVotes === 1 ? "" : "s"}</div>
          <table class="data-table" style="margin-top:6px">
            <thead><tr>
              <th>Option</th><th style="text-align:right">Votes</th>
              ${!v.is_anonymous ? "<th>Members</th>" : ""}
            </tr></thead>
            <tbody>${optRows}</tbody>
          </table>
        </div>`;
    }).join("")}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 14mm; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 13px; color: #111; background: #fff; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; border-bottom: 2px solid #1a1a2e; margin-bottom: 14px; }
  .header img { width: 56px; height: 56px; object-fit: contain; }
  .header h1 { margin: 0; font-size: 18px; font-weight: 900; color: #1a1a2e; }
  .header .sub { font-size: 13px; color: #555; margin-top: 2px; }
  .section-title { font-size: 15px; font-weight: 900; color: #1a1a2e; margin: 16px 0 6px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
  .pre { white-space: pre-wrap; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .data-table th { text-align: left; border-bottom: 1px solid #ccc; padding: 5px 8px 5px 0; font-weight: 700; }
  .data-table td { border-bottom: 1px solid #f0f0f0; padding: 4px 8px 4px 0; vertical-align: top; }
  .officer-block { margin-bottom: 10px; }
  .officer-key { font-weight: 800; font-size: 13px; margin-bottom: 2px; }
  .motion { margin: 6px 0; font-size: 13px; }
</style>
</head>
<body>
  <div class="header">
    <img src="${logoDataUrl}" alt="Alpha Beta">
    <div>
      <h1>Phi Kappa Sigma — Alpha Beta</h1>
      <div class="sub">${esc(meeting.title?.trim() || "Chapter Meeting Minutes")} • ${esc(dateStr)}</div>
    </div>
  </div>

  <div class="section-title">Attendance</div>
  <table class="data-table">
    <thead><tr><th>Member</th><th>Status</th><th>Details</th></tr></thead>
    <tbody>${attendanceHtml}</tbody>
  </table>

  <div class="section-title">Opening</div>
  <div class="motion">Motion to accept previous week’s minutes by <b>${esc(name(meeting.motion_accept_moved_by_brother_id))}</b>, seconded by <b>${esc(name(meeting.motion_accept_seconded_by_brother_id))}</b>.</div>

  <div class="section-title">Communications / Committees</div>
  <div class="pre">${body(meeting.communications)}</div>

  ${officer_notes.length > 0 ? `<div class="section-title">Officer Reports</div>${officerHtml}` : ""}

  <div class="section-title">Old Business</div>
  <div class="pre">${body(meeting.old_business)}</div>

  <div class="section-title">New Business</div>
  <div class="pre">${body(meeting.new_business)}</div>

  ${votesHtml}

  <div class="section-title">Closing</div>
  <div style="font-weight:800;font-size:13px;margin:6px 0 2px">Betterment</div>
  <div class="pre">${body(meeting.betterment)}</div>
  <div class="motion" style="margin-top:8px">Motion to end meeting by <b>${esc(name(meeting.motion_end_moved_by_brother_id))}</b>, seconded by <b>${esc(name(meeting.motion_end_seconded_by_brother_id))}</b>.</div>
</body>
</html>`;
}

async function generateMeetingPdf(meetingId) {
  const puppeteer = require("puppeteer");
  const data = await fetchMeetingForPdf(meetingId);
  if (!data) throw new Error("Meeting not found");

  const html = buildPdfHtml(data);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });
    return { pdf, data };
  } finally {
    await browser.close();
  }
}

module.exports = { generateMeetingPdf, fetchMeetingForPdf, buildPdfHtml };
