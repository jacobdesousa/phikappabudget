#!/usr/bin/env node
/**
 * Renders every email the platform sends to HTML files you can open, using
 * sample data — no database, no SES, nothing sent.
 *
 *   node scripts/preview-emails.js [outDir]
 *
 * Then open the printed index.html. Useful for checking wording and layout
 * without waiting for a Monday or putting a real instalment in the database.
 */
const fs = require("fs");
const path = require("path");

process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "https://app.uoftskulls.ca";
process.env.MAIL_PROVIDER = "dev";

const { weeklyDigest, paymentReminder } = require("../src/jobs/templates");

const outDir = process.argv[2] ?? path.join(__dirname, "..", ".email-preview");
fs.mkdirSync(outDir, { recursive: true });

// Sample feed items, in the shape notificationFeed.js produces.
const items = [
  { kind: "makeup", title: "Makeup owed — Workday", detail: "Move-in — Assigned: kitchen deep clean",
    date: "2026-09-14", days_until: -21, severity: "urgent" },
  { kind: "makeup", title: "Makeup owed — Cleanup shift", detail: "Homecoming",
    date: "2026-09-28", days_until: -7, severity: "urgent" },
  { kind: "shift", title: "Cleanup shift", detail: "Post-formal",
    date: "2026-10-07", days_until: 2, severity: "warning" },
  { kind: "shift", title: "Party shift", detail: "Fall Formal — Bar, 9:00 PM – 10:00 PM",
    date: "2026-10-10", days_until: 5, severity: "info" },
  { kind: "workday", title: "Workday", detail: "Fall cleanup",
    date: "2026-10-12", days_until: 7, severity: "info" },
  { kind: "chore_duty", title: "Chore duty this period", detail: "Kitchen — Oct 1–15",
    date: "2026-10-01", days_until: -4, severity: "warning" },
];

const cases = [
  {
    name: "01-weekly-digest",
    label: "Weekly digest — a full week",
    ...weeklyDigest({ firstName: "Aidan", items }),
  },
  {
    name: "02-weekly-digest-single",
    label: "Weekly digest — one item only",
    ...weeklyDigest({ firstName: "Ali", items: [items[2]] }),
  },
  {
    name: "03-dues-upcoming",
    label: "Dues — two weeks out (T-14)",
    ...paymentReminder({
      firstName: "Aidan",
      kind: "dues_due",
      overdue: false,
      item: { title: "Dues instalment due", detail: "$450 — Instalment 2 of 4",
              date: "2026-10-19", days_until: 14, severity: "info" },
    }),
  },
  {
    name: "04-dues-overdue",
    label: "Dues — outstanding",
    ...paymentReminder({
      firstName: "Aidan",
      kind: "dues_due",
      overdue: true,
      item: { title: "Dues outstanding", detail: "$250 — Instalment 1 of 4",
              date: "2026-09-15", days_until: -20, severity: "urgent" },
    }),
  },
  {
    name: "05-house-upcoming",
    label: "House fees — one week out (T-7)",
    ...paymentReminder({
      firstName: "Conrad",
      kind: "house_fee_due",
      overdue: false,
      item: { title: "House fee instalment due", detail: "$1,300 — Instalment 2 of 4 — Room 2B",
              date: "2026-10-12", days_until: 7, severity: "info" },
    }),
  },
  {
    name: "06-house-overdue",
    label: "House fees — outstanding",
    ...paymentReminder({
      firstName: "Conrad",
      kind: "house_fee_due",
      overdue: true,
      item: { title: "House fees outstanding", detail: "$1,300 — Instalment 1 of 4 — Room 2B",
              date: "2026-09-15", days_until: -20, severity: "urgent" },
    }),
  },
];

for (const c of cases) {
  fs.writeFileSync(path.join(outDir, `${c.name}.html`), c.html);
  fs.writeFileSync(path.join(outDir, `${c.name}.txt`), `Subject: ${c.subject}\n\n${c.text}`);
}

// An index so every version is one click away.
const index = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Email previews</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#eef1f7;color:#101b2d}
  h1{font-size:20px;margin:0 0 4px} p.sub{margin:0 0 24px;color:#667}
  .case{margin:0 0 32px;background:#fff;border:1px solid #d8dde8;border-radius:8px;overflow:hidden}
  .hd{padding:12px 16px;border-bottom:1px solid #e8ecf3}
  .label{font-weight:700;font-size:14px} .subject{font-size:13px;color:#667;margin-top:2px}
  .links{font-size:12px;margin-top:6px} .links a{color:#1f4b99;margin-right:12px}
  iframe{width:100%;height:640px;border:0;display:block;background:#f6f7fb}
</style></head>
<body>
  <h1>Email previews</h1>
  <p class="sub">Sample data. Nothing here was sent, and no database was touched.</p>
  ${cases
    .map(
      (c) => `<div class="case">
    <div class="hd">
      <div class="label">${c.label}</div>
      <div class="subject"><b>Subject:</b> ${c.subject}</div>
      <div class="links"><a href="${c.name}.html" target="_blank">open HTML</a><a href="${c.name}.txt" target="_blank">plain text</a></div>
    </div>
    <iframe src="${c.name}.html" title="${c.label}"></iframe>
  </div>`
    )
    .join("\n")}
</body></html>`;
fs.writeFileSync(path.join(outDir, "index.html"), index);

console.log(`Wrote ${cases.length} previews to ${outDir}`);
console.log(`Open: ${path.join(outDir, "index.html")}`);
