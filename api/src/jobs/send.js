const { sendMail } = require("../utils/mailer");
const { claimSend, settleSend, releaseSend } = require("./ledger");

// Sending a batch of reminders.
//
// The meeting-minutes fan-out fires every recipient at once with
// Promise.allSettled. That is fine for a dozen people and not fine for a
// chapter-wide digest: SES's default sending rate is 14/second and the whole
// send would be rejected part-way through, leaving no record of who missed out.

const BATCH_SIZE = 8;
const BATCH_PAUSE_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {Array} tasks  {brotherId, toEmail, emailKind, dedupeKey, subject, html, text, itemCount}
 * @param {{dryRun?: boolean}} opts
 * @returns {Promise<{sent: number, skipped: number, failed: number, no_address: number, recipients: Array}>}
 */
async function sendBatch(tasks, { dryRun = false } = {}) {
  const summary = { sent: 0, skipped: 0, failed: 0, no_address: 0, recipients: [] };

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (task) => {
        // No address on file: not a failure, and not something to claim — once
        // an address is added the next run should reach them.
        if (!task.toEmail) {
          summary.no_address += 1;
          summary.recipients.push({ ...describe(task), outcome: "no_address" });
          return;
        }

        if (dryRun) {
          summary.recipients.push({ ...describe(task), outcome: "would_send" });
          return;
        }

        const claimId = await claimSend({
          brotherId: task.brotherId,
          emailKind: task.emailKind,
          dedupeKey: task.dedupeKey,
          toEmail: task.toEmail,
          itemCount: task.itemCount ?? 0,
        });
        if (!claimId) {
          summary.skipped += 1;
          summary.recipients.push({ ...describe(task), outcome: "already_sent" });
          return;
        }

        try {
          await sendMail({
            to: task.toEmail,
            subject: task.subject,
            html: task.html,
            text: task.text,
            kind: task.emailKind,
            context: { brotherId: task.brotherId, dedupeKey: task.dedupeKey },
            headers: task.headers,
          });
          await settleSend(claimId, { status: "sent" });
          summary.sent += 1;
          summary.recipients.push({ ...describe(task), outcome: "sent" });
        } catch (err) {
          // The claim stays, so a transient SES error does not turn into a
          // duplicate on the next run. The row records why.
          await settleSend(claimId, { status: "failed", error: err?.message ?? String(err) });
          summary.failed += 1;
          summary.recipients.push({ ...describe(task), outcome: "failed", error: err?.message });
        }
      })
    );

    if (i + BATCH_SIZE < tasks.length) await sleep(BATCH_PAUSE_MS);
  }

  return summary;
}

function describe(task) {
  return {
    brother_id: task.brotherId,
    to_email: task.toEmail ?? null,
    subject: task.subject,
    item_count: task.itemCount ?? 0,
    dedupe_key: task.dedupeKey,
  };
}

module.exports = { sendBatch, releaseSend, BATCH_SIZE };
