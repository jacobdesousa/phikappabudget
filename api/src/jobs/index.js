const cron = require("node-cron");
const { env } = require("../config/env");
const { runWeeklyDigest } = require("./weeklyDigest");
const { runPaymentReminders } = require("./paymentReminders");

// Scheduled reminder emails.
//
// In-process rather than an EB worker tier: there is one web environment, and
// a second tier is a lot of infrastructure for two jobs. Correctness does not
// depend on only one instance running — the notification_sends unique index
// means a rolling deploy with two instances still produces one email.
//
// Nothing registers unless JOBS_ENABLED=true, so a dev box, a one-off script
// and a local `npm run dev` are all silent by default.

async function runGuarded(name, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn({});
    console.log(
      `[jobs] ${name} finished in ${Date.now() - startedAt}ms:`,
      JSON.stringify({
        sent: result.sent,
        skipped: result.skipped,
        failed: result.failed,
        no_address: result.no_address,
      })
    );
  } catch (err) {
    // A job throwing must not take the API down with it.
    console.error(`[jobs] ${name} failed:`, err?.message ?? err);
  }
}

function startJobs() {
  if (!env.jobs.enabled) {
    console.log("[jobs] disabled (set JOBS_ENABLED=true to schedule reminder emails)");
    return { stop: () => {} };
  }

  const options = { timezone: env.jobs.timezone };
  const tasks = [
    cron.schedule(env.jobs.digestCron, () => runGuarded("weekly_digest", runWeeklyDigest), options),
    cron.schedule(
      env.jobs.paymentCron,
      () => runGuarded("payment_reminders", runPaymentReminders),
      options
    ),
  ];

  console.log(
    `[jobs] scheduled: digest "${env.jobs.digestCron}", payments "${env.jobs.paymentCron}" ` +
      `(${env.jobs.timezone}); payment kinds: ${env.jobs.paymentKinds.join(", ") || "none"}`
  );

  return {
    stop: () => tasks.forEach((t) => t.stop()),
  };
}

module.exports = { startJobs };
