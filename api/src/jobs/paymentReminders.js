const { pool } = require("../db/pool");
const { buildFeeds } = require("../services/notificationFeed");
const { loadOptOuts, isOptedIn } = require("../services/notificationPrefs");
const { todayInToronto, daysBetween } = require("../utils/schoolYear");
const { appUrl } = require("../utils/emailLayout");
const { paymentReminder } = require("./templates");
const { sendBatch } = require("./send");
const { env } = require("../config/env");

// Money reminders, one email per instalment.
//
// A heads-up two weeks out, another at one week, one on the day, then a weekly
// nudge while the balance is still short. Paying stops all of it: the feed only
// produces an item while something is outstanding, so a covered instalment
// simply has nothing to send.

// Days BEFORE the due date, so these are positive: days_until counts forward.
const OFFSETS = [14, 7, 0];

function offsetLabel(daysUntil) {
  if (!OFFSETS.includes(daysUntil)) return null;
  return daysUntil === 0 ? "T-0" : `T-${daysUntil}`;
}

/**
 * @param {{asOf?: string, dryRun?: boolean, brotherId?: number|null, kinds?: string[]}} opts
 *   `kinds` defaults to whatever is enabled in config — dues is off until the
 *   chapter has confirmed the schedule.
 */
async function runPaymentReminders({
  asOf = todayInToronto(),
  dryRun = false,
  brotherId = null,
  kinds = null,
} = {}) {
  const enabled = kinds ?? env.jobs.paymentKinds;
  if (enabled.length === 0) {
    return { job: "payment_reminders", as_of: asOf, dry_run: dryRun, disabled: true, ...empty() };
  }

  const { rows: audience } = await pool.query(
    `SELECT b.id, b.first_name,
            COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(b.email), ''), NULLIF(TRIM(b.email_secondary), '')) AS to_email
     FROM brothers b
     LEFT JOIN users u ON u.brother_id = b.id AND u.status = 'active'
     WHERE ($1::int IS NULL OR b.id = $1)
     ORDER BY b.id`,
    [brotherId]
  );

  const optOuts = await loadOptOuts();
  const byId = new Map(audience.map((b) => [Number(b.id), b]));

  // The feed decides who owes what; status does not come into it. A boarder is
  // not an active member but still owes residence fees, and an alumnus with a
  // current assignment does too.
  const feeds = await buildFeeds({
    brotherIds: audience.map((b) => Number(b.id)),
    asOf,
    kinds: enabled,
  });

  // Monday is the weekly nudge for anything already overdue — daily would be
  // nagging.
  const isMonday = new Date(`${asOf}T12:00:00Z`).getUTCDay() === 1;
  const tasks = [];

  for (const [id, items] of feeds) {
    const brother = byId.get(id);
    if (!brother) continue;

    for (const item of items) {
      if (!enabled.includes(item.kind)) continue;
      if (!isOptedIn(optOuts, id, item.kind)) continue;

      const daysUntil = daysBetween(asOf, item.date);
      const overdue = daysUntil < 0;

      let occurrence = offsetLabel(daysUntil);
      if (!occurrence && overdue && isMonday) occurrence = `overdue:${asOf}`;
      // Not a send day for this instalment.
      if (!occurrence) continue;

      const { subject, html, text } = paymentReminder({
        firstName: brother.first_name,
        item,
        kind: item.kind,
        overdue,
      });

      tasks.push({
        brotherId: id,
        toEmail: brother.to_email,
        emailKind: item.kind,
        // The occurrence is part of the key, so T-14, T-7, T-0 and each weekly
        // overdue nudge are four distinct sends against the same instalment.
        dedupeKey: `${item.key}:${occurrence}`,
        subject,
        html,
        text,
        itemCount: 1,
        headers: { "List-Unsubscribe": `<${appUrl("/notifications")}>` },
      });
    }
  }

  const summary = await sendBatch(tasks, { dryRun });
  return {
    job: "payment_reminders",
    as_of: asOf,
    dry_run: dryRun,
    kinds: enabled,
    audience: audience.length,
    due_today: tasks.length,
    ...summary,
  };
}

function empty() {
  return { audience: 0, due_today: 0, sent: 0, skipped: 0, failed: 0, no_address: 0, recipients: [] };
}

module.exports = { runPaymentReminders, OFFSETS };
