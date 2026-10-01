-- ==========================================================================
-- email_log — a record of every email the platform sends
--
-- One row per recipient, written by api/src/utils/mailer.js itself, so a new
-- sender cannot forget to log. Covers dev-mode sends (which never leave the
-- box) and failures, which previously vanished: the minutes fan-out counted
-- failures and threw the reason away, and the invite/reset flows wrote their
-- audit row BEFORE sending, so a row meant "we tried", not "it went".
--
-- Bodies are stored as the plain-text part only; attachments are recorded by
-- filename, never by content.
--
-- api/src/db/init.js creates the same table on boot, so running this by hand
-- is only needed to get ahead of a deploy.
--
-- Review then run: COMMIT;  (or ROLLBACK; to undo)
-- ==========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS email_log (
  id                  BIGSERIAL PRIMARY KEY,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  kind                TEXT NOT NULL DEFAULT 'other',
  to_email            TEXT NOT NULL,
  subject             TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  error               TEXT,
  body_text           TEXT,
  attachments         TEXT,
  brother_id          INTEGER REFERENCES brothers(id) ON DELETE SET NULL,
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  dedupe_key          TEXT
);

CREATE INDEX IF NOT EXISTS email_log_created_idx ON email_log (created_at DESC);
CREATE INDEX IF NOT EXISTS email_log_to_idx      ON email_log (to_email, created_at DESC);
CREATE INDEX IF NOT EXISTS email_log_kind_idx    ON email_log (kind, created_at DESC);

COMMIT;
