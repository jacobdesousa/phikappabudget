const { env } = require("../config/env");

// The chapter's email shell, in one place.
//
// The same dark header markup was pasted into the invite, the password reset
// and the meeting minutes, and `esc` was declared twice. Notification emails
// would have made it four copies, so it lives here instead.
//
// Everything is tables and inline styles on purpose: Outlook and Gmail still
// discard <style> blocks and most modern layout.

const LOGO_URL = "https://uoftskulls.ca/alphabeta.png";
const INK = "#1a1a2e";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function appUrl(path = "") {
  return `${env.appBaseUrl.replace(/\/$/, "")}${path}`;
}

function header(subtitle) {
  return `<tr><td style="background:${INK};padding:20px 32px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px;vertical-align:middle">
        <img src="${LOGO_URL}" alt="Alpha Beta" width="36" height="36" style="display:block">
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:17px;font-weight:700;letter-spacing:.3px">Phi Kappa Sigma</div>
        <div style="color:#aaa;font-size:12px;margin-top:1px">${esc(subtitle ?? "Alpha Beta Chapter")}</div>
      </td>
    </tr></table>
  </td></tr>`;
}

/** A call-to-action button that survives clients with no CSS. */
function button(label, url) {
  return `<table cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px">
    <tr><td bgcolor="${INK}" style="border-radius:6px;padding:12px 24px">
      <a href="${url}" target="_blank" style="color:#fff;text-decoration:none;font-size:15px;font-weight:600;font-family:sans-serif">${esc(label)}</a>
    </td></tr>
  </table>`;
}

/**
 * One notification line: the date on the left, what it is on the right.
 * Deliberately the same wording the page shows — the feed builds both.
 */
function itemRow(item) {
  const urgent = item.severity === "urgent";
  const when = item.when ?? "";
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:top;width:92px">
      <span style="font-size:12px;font-weight:700;color:${urgent ? "#b3261e" : "#555"}">${esc(when)}</span>
    </td>
    <td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:top">
      <div style="font-size:14px;color:#111;font-weight:600">${esc(item.title)}</div>
      ${item.detail ? `<div style="font-size:13px;color:#666;margin-top:2px">${esc(item.detail)}</div>` : ""}
    </td>
  </tr>`;
}

/** A titled block of item rows. Returns "" for an empty list, so callers can
 *  concatenate sections without checking each one. */
function section(title, items) {
  if (!items || items.length === 0) return "";
  return `<div style="margin:0 0 24px">
    <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">${esc(title)}</div>
    <table width="100%" cellpadding="0" cellspacing="0">${items.map(itemRow).join("")}</table>
  </div>`;
}

function manageFooter() {
  return `<p style="margin:0;font-size:12px;color:#999">
    You're receiving this because you're on the chapter roster.
    <a href="${appUrl("/notifications")}" style="color:#999">Manage which emails you get</a>.
  </p>`;
}

/**
 * The full document. `bodyHtml` is whatever the specific email wants between
 * the greeting and the footer.
 */
function renderEmail({ subtitle, heading, greeting, bodyHtml, cta, footerHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;margin:0;padding:32px 16px;background:#f6f7fb">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">
    ${header(subtitle)}
    <tr><td style="padding:32px">
      ${greeting ? `<p style="margin:0 0 12px;font-size:16px;color:#111;font-weight:600">${esc(greeting)}</p>` : ""}
      ${heading ? `<p style="margin:0 0 16px;font-size:16px;color:#111">${esc(heading)}</p>` : ""}
      ${bodyHtml ?? ""}
      ${cta ? button(cta.label, cta.url) : ""}
      ${footerHtml ?? manageFooter()}
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { renderEmail, section, itemRow, button, esc, appUrl, manageFooter, LOGO_URL, INK };
