-- ==========================================================================
-- notification_prefs + notification_sends — reminder emails
--
-- notification_prefs: which reminder emails a brother has turned off. Absence
-- of a row means opted IN, so a new email kind reaches people without a
-- backfill. opted_out is a column rather than row-existence so opting back in
-- keeps the history instead of deleting it.
--
-- notification_sends: the send-once ledger. email_log records what happened;
-- this decides what is allowed to happen. The unique index is the guarantee —
-- a row is claimed before the send and settled after, so two instances racing
-- (which a rolling deploy causes) can still only produce one email. A crash
-- between claim and send leaves a 'pending' row, which is never retried: a
-- missed reminder beats a duplicate one.
--
-- api/src/db/init.js creates the same tables on boot, so running this by hand
-- is only needed to get ahead of a deploy.
--
-- Review then run: COMMIT;  (or ROLLBACK; to undo)
-- ==========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS notification_prefs (
  brother_id INTEGER NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
  email_kind TEXT NOT NULL,
  opted_out  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (brother_id, email_kind)
);

CREATE TABLE IF NOT EXISTS notification_sends (
  id          BIGSERIAL PRIMARY KEY,
  brother_id  INTEGER NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
  email_kind  TEXT NOT NULL,
  dedupe_key  TEXT NOT NULL,
  to_email    TEXT,
  item_count  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending',
  error       TEXT,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_sends_unique_occurrence
  ON notification_sends (brother_id, email_kind, dedupe_key);
CREATE INDEX IF NOT EXISTS notification_sends_recent_idx
  ON notification_sends (claimed_at DESC);

COMMIT;
