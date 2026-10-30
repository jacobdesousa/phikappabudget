const { renderEmail, section, appUrl } = require("../utils/emailLayout");

// The reminder emails. Content comes from the same feed the notifications page
// renders, so an email can never say something the app disagrees with.

// "2026-10-19" -> "Mon, Oct 19". Read in UTC so a calendar date never shifts a
// day depending on where the server is.
function longDate(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return String(ymd ?? "");
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "In 3 days" / "Tomorrow" / "2 days ago" — the page's wording, reused. */
function whenLabel(item) {
  const d = item.days_until;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d < 0) return `${Math.abs(d)} days ago`;
  if (d <= 7) return `In ${d} days`;
  return longDate(item.date);
}

function withWhen(items) {
  return items.map((i) => ({ ...i, when: whenLabel(i) }));
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The Monday digest: shifts, workdays, chore duty and outstanding makeups.
 * Only ever built for someone who has at least one item — an empty digest is
 * worse than no digest.
 */
function weeklyDigest({ firstName, items }) {
  const byKind = (kind) => withWhen(items.filter((i) => i.kind === kind));
  const makeups = byKind("makeup");
  const shifts = byKind("shift");
  const workdays = byKind("workday");
  const chores = byKind("chore_duty");

  const bodyHtml = [
    // Makeups first: they are the only thing already overdue.
    section("Makeups owed", makeups),
    section("Shifts", shifts),
    section("Workdays", workdays),
    section("Chore duty", chores),
  ].join("");

  const subject = `This week at Alpha Beta — ${plural(items.length, "reminder")}`;

  const text = [
    firstName ? `Hi ${firstName},` : "Hi,",
    "",
    "Coming up for you:",
    "",
    ...items.map((i) => `- ${whenLabel(i)}: ${i.title}${i.detail ? ` (${i.detail})` : ""}`),
    "",
    `See everything: ${appUrl("/notifications")}`,
  ].join("\n");

  return {
    subject,
    text,
    html: renderEmail({
      subtitle: "Weekly reminders",
      greeting: firstName ? `Hi ${firstName},` : null,
      heading: "Here's what's coming up for you this week.",
      bodyHtml,
      cta: { label: "Open notifications", url: appUrl("/notifications") },
    }),
  };
}

/**
 * A money reminder — dues or residence fees. One instalment per email, because the
 * two are different money owed to different places.
 *
 * The wording is deliberately "outstanding to date" rather than "this
 * instalment is unpaid": payments are a single pool with no per-instalment
 * allocation, so the figure is cumulative and the sentence has to match it.
 */
function paymentReminder({ firstName, item, kind, overdue }) {
  const isDues = kind === "dues_due";
  const what = isDues ? "Dues" : "Residence fees";
  // The account page is the one place every brother can see their own money.
  const href = "/account";

  const amount = item.detail.split(" — ")[0];
  const rest = item.detail.split(" — ").slice(1).join(" — ");
  const dueLine = overdue ? `Was due ${longDate(item.date)}` : `Due ${longDate(item.date)}`;

  const subject = overdue
    ? `${what} outstanding — ${amount}`
    : `${what} due ${longDate(item.date)} — ${amount}`;

  // "residence fees instalment" reads wrong; the singular belongs before the
  // noun and the plural in the standalone sentence.
  const singular = isDues ? "dues" : "residence fee";
  const heading = overdue
    ? `Your ${what.toLowerCase()} are showing an outstanding balance.`
    : `Your next ${singular} instalment is coming up.`;

  const bodyHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #eee;border-radius:6px">
      <tr>
        <td style="padding:16px 18px">
          <div style="font-size:24px;font-weight:700;color:#111">${amount}</div>
          <div style="font-size:13px;color:#666;margin-top:4px">${rest}</div>
          <div style="font-size:13px;color:${overdue ? "#b3261e" : "#666"};margin-top:8px">${dueLine}</div>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:13px;color:#666">
      This is the amount outstanding to date. If you've paid since this was sent, nothing further is needed.
    </p>`;

  const text = [
    firstName ? `Hi ${firstName},` : "Hi,",
    "",
    heading,
    "",
    `${item.title}: ${item.detail}`,
    dueLine,
    "",
    "This is the amount outstanding to date. If you've paid since this was sent, nothing further is needed.",
    "",
    `See the detail: ${appUrl(href)}`,
  ].join("\n");

  return {
    subject,
    text,
    html: renderEmail({
      subtitle: isDues ? "Dues" : "Residence fees",
      greeting: firstName ? `Hi ${firstName},` : null,
      heading,
      bodyHtml,
      cta: { label: isDues ? "View your dues" : "View your residence fees", url: appUrl(href) },
    }),
  };
}

module.exports = { weeklyDigest, paymentReminder, whenLabel };
