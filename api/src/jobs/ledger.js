const { pool } = require("../db/pool");

// The send-once ledger.
//
// email_log says what happened; this decides what is allowed to happen. The
// unique index on (brother_id, email_kind, dedupe_key) is the real guarantee —
// a rolling EB deploy runs two instances for a few seconds, and an advisory
// lock on a pooled Postgres connection cannot be relied on, so correctness has
// to live in the database constraint rather than in coordination.

/**
 * Claim the right to send. Returns the row id, or null when someone already
 * holds the claim — the caller should then skip silently.
 */
async function claimSend({ brotherId, emailKind, dedupeKey, toEmail, itemCount }) {
  const { rows } = await pool.query(
    `INSERT INTO notification_sends (brother_id, email_kind, dedupe_key, to_email, item_count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (brother_id, email_kind, dedupe_key) DO NOTHING
     RETURNING id`,
    [brotherId, emailKind, dedupeKey, toEmail ?? null, itemCount ?? 0]
  );
  return rows[0]?.id ?? null;
}

async function settleSend(id, { status, error = null }) {
  if (!id) return;
  try {
    await pool.query(
      `UPDATE notification_sends
         SET status = $2, sent_at = NOW(), error = $3
       WHERE id = $1`,
      [id, status, error ? String(error).slice(0, 2000) : null]
    );
  } catch {
    // The claim is what matters; losing the outcome must not crash a job.
  }
}

/**
 * Release a claim. Used when the send is abandoned before it is attempted —
 * a dry run, or no address on file — so the reminder can go out later.
 */
async function releaseSend(id) {
  if (!id) return;
  try {
    await pool.query(`DELETE FROM notification_sends WHERE id = $1 AND status = 'pending'`, [id]);
  } catch {
    // ignore
  }
}

module.exports = { claimSend, settleSend, releaseSend };
