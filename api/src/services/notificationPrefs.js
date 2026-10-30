const { pool } = require("../db/pool");

// Which reminder emails a brother gets.
//
// Keyed on the EMAIL, not on the six item kinds: shifts, workdays, chores and
// makeups all ride the same weekly digest, so they cannot be opted out of
// separately without splitting that email. "all" is the single switch that
// silences everything.

const EMAIL_KINDS = ["weekly_digest", "dues_due", "house_fee_due"];
const ALL = "all";

/** Every opt-out, as a Set of `brotherId|kind` — one query, never N+1. */
async function loadOptOuts() {
  const { rows } = await pool.query(
    `SELECT brother_id, email_kind FROM notification_prefs WHERE opted_out = TRUE`
  );
  return new Set(rows.map((r) => `${Number(r.brother_id)}|${r.email_kind}`));
}

/** Absence of a row means opted in, so a new kind reaches people by default. */
function isOptedIn(optOuts, brotherId, kind) {
  if (optOuts.has(`${brotherId}|${ALL}`)) return false;
  return !optOuts.has(`${brotherId}|${kind}`);
}

/** One brother's switches, with the defaults filled in. */
async function prefsForBrother(brotherId) {
  const { rows } = await pool.query(
    `SELECT email_kind, opted_out FROM notification_prefs WHERE brother_id = $1`,
    [brotherId]
  );
  const optedOut = new Set(rows.filter((r) => r.opted_out).map((r) => r.email_kind));
  const prefs = { all: !optedOut.has(ALL) };
  for (const kind of EMAIL_KINDS) prefs[kind] = !optedOut.has(kind);
  return prefs;
}

/** `patch` is {kind: enabled}; enabled=true clears the opt-out. */
async function setPrefs(brotherId, patch) {
  const entries = Object.entries(patch).filter(([kind]) => kind === ALL || EMAIL_KINDS.includes(kind));
  for (const [kind, enabled] of entries) {
    await pool.query(
      `INSERT INTO notification_prefs (brother_id, email_kind, opted_out, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (brother_id, email_kind)
       DO UPDATE SET opted_out = EXCLUDED.opted_out, updated_at = NOW()`,
      [brotherId, kind, !enabled]
    );
  }
  return prefsForBrother(brotherId);
}

module.exports = { EMAIL_KINDS, ALL, loadOptOuts, isOptedIn, prefsForBrother, setPrefs };
