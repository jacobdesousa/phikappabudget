const { pool } = require("../db/pool");
const { buildFeeds } = require("../services/notificationFeed");
const { loadOptOuts, isOptedIn } = require("../services/notificationPrefs");
const { todayInToronto } = require("../utils/schoolYear");
const { appUrl } = require("../utils/emailLayout");
const { weeklyDigest } = require("./templates");
const { sendBatch } = require("./send");

// The Monday digest: what is coming up for you this week.
//
// Actives only. Alumni have no shifts, workdays, chores or makeups, so their
// digest would always be empty; pledges are excluded by the same rule, but
// still get the money emails, which follow what is owed rather than status.

const EMAIL_KIND = "weekly_digest";
const DIGEST_KINDS = ["shift", "workday", "chore_duty", "makeup"];

/** The Monday of the week `asOf` falls in — the digest's natural dedupe key. */
function weekOf(asOf) {
  const [y, m, d] = asOf.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay: 0 = Sunday, so Sunday belongs to the week that started 6 days ago.
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

async function runWeeklyDigest({ asOf = todayInToronto(), dryRun = false, brotherId = null } = {}) {
  // users.email is the login address and the one they actually read; the
  // roster addresses are the fallback, matching how minutes are sent.
  const { rows: audience } = await pool.query(
    `SELECT b.id, b.first_name, b.status,
            COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(b.email), ''), NULLIF(TRIM(b.email_secondary), '')) AS to_email
     FROM brothers b
     LEFT JOIN users u ON u.brother_id = b.id AND u.status = 'active'
     WHERE b.status = 'Active'
       AND ($1::int IS NULL OR b.id = $1)
     ORDER BY b.id`,
    [brotherId]
  );
  if (audience.length === 0) {
    return { job: "weekly_digest", as_of: asOf, dedupe_key: `digest:${weekOf(asOf)}`, ...empty() };
  }

  const optOuts = await loadOptOuts();
  const eligible = audience.filter((b) => isOptedIn(optOuts, Number(b.id), EMAIL_KIND));

  const feeds = await buildFeeds({
    brotherIds: eligible.map((b) => Number(b.id)),
    asOf,
    kinds: DIGEST_KINDS,
  });

  const dedupeKey = `digest:${weekOf(asOf)}`;
  const tasks = [];

  for (const brother of eligible) {
    const items = feeds.get(Number(brother.id)) ?? [];
    // No empty digests — an email that says "nothing to report" teaches people
    // to ignore the next one.
    if (items.length === 0) continue;

    const { subject, html, text } = weeklyDigest({ firstName: brother.first_name, items });
    tasks.push({
      brotherId: Number(brother.id),
      toEmail: brother.to_email,
      emailKind: EMAIL_KIND,
      dedupeKey,
      subject,
      html,
      text,
      itemCount: items.length,
      headers: { "List-Unsubscribe": `<${appUrl("/notifications")}>` },
    });
  }

  const summary = await sendBatch(tasks, { dryRun });
  return {
    job: "weekly_digest",
    as_of: asOf,
    dedupe_key: dedupeKey,
    dry_run: dryRun,
    audience: audience.length,
    eligible: eligible.length,
    with_items: tasks.length,
    ...summary,
  };
}

function empty() {
  return { dry_run: false, audience: 0, eligible: 0, with_items: 0, sent: 0, skipped: 0, failed: 0, no_address: 0, recipients: [] };
}

module.exports = { runWeeklyDigest, weekOf, EMAIL_KIND };
