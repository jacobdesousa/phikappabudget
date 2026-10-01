const { pool } = require("../db/pool");

// The log of what the platform emailed, written from sendMail so no sender can
// skip it. Best-effort in the same spirit as auditLog: a logging failure must
// never stop an email going out, and must never turn a successful send into a
// failed request.
//
// A row is claimed before the send and settled after, so a crash mid-send
// leaves a `pending` row rather than no evidence at all.

// The body is kept as the plain-text part only — the HTML says the same thing
// at ten times the size — and long bodies are clipped rather than refused.
const MAX_BODY = 20000;

function clip(value) {
  if (value == null) return null;
  const s = String(value);
  return s.length > MAX_BODY ? `${s.slice(0, MAX_BODY)}\n…[truncated]` : s;
}

/**
 * One row per recipient, so "did this person get it" is a lookup rather than a
 * search through comma-joined address lists.
 *
 * @returns {Promise<number[]>} row ids, aligned with `recipients`. Empty when
 *   logging failed — callers must treat an id as optional.
 */
async function claimEmailLog({ recipients, subject, kind, bodyText, attachments, context }) {
  const ctx = context ?? {};
  const attachmentNames = (attachments ?? []).map((a) => a.filename).join(", ") || null;

  try {
    const ids = [];
    for (const to of recipients) {
      const { rows } = await pool.query(
        `INSERT INTO email_log
           (kind, to_email, subject, status, body_text, attachments,
            brother_id, user_id, actor_user_id, dedupe_key)
         VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          String(kind ?? "other"),
          String(to),
          String(subject ?? ""),
          clip(bodyText),
          attachmentNames,
          ctx.brotherId ?? null,
          ctx.userId ?? null,
          ctx.actorUserId ?? null,
          ctx.dedupeKey ?? null,
        ]
      );
      ids.push(rows[0]?.id ?? null);
    }
    return ids;
  } catch {
    return [];
  }
}

/** Settle claimed rows once the provider has answered. */
async function settleEmailLog(ids, { status, providerMessageId = null, error = null }) {
  const real = (ids ?? []).filter((id) => id != null);
  if (real.length === 0) return;
  try {
    await pool.query(
      `UPDATE email_log
         SET status = $2,
             sent_at = NOW(),
             provider_message_id = $3,
             error = $4
       WHERE id = ANY($1::bigint[])`,
      [real, status, providerMessageId, error ? String(error).slice(0, 2000) : null]
    );
  } catch {
    // ignore
  }
}

module.exports = { claimEmailLog, settleEmailLog };
