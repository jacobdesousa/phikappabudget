-- ==========================================================================
-- notification_reads — which notification items a brother has read
--
-- The notifications feed is derived on every request from shifts, workdays,
-- chores, makeups, dues and house fees, so there are no notification rows to
-- create or expire. The one thing worth storing is the read mark, keyed on the
-- item's stable key (built from ids and dates, so it survives between runs).
--
-- api/src/db/init.js creates the same table on boot, so running this by hand
-- is only needed to get ahead of a deploy.
--
-- Review then run: COMMIT;  (or ROLLBACK; to undo)
-- ==========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS notification_reads (
  brother_id INTEGER NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
  item_key   TEXT NOT NULL,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (brother_id, item_key)
);

CREATE INDEX IF NOT EXISTS notification_reads_brother_idx
  ON notification_reads (brother_id, read_at DESC);

COMMIT;
