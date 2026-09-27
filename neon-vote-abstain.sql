-- ==========================================================================
-- is_abstain — every vote carries an Abstain option
--
-- Abstaining is always allowed, so the option is added for the Sigma rather
-- than typed out each time. The flag marks which option it is, so the UI can
-- keep it last and read it as "no position" instead of as a choice.
--
-- Open votes created before this get an Abstain option here. Closed votes are
-- a record of what was on the ballot at the time and are left alone.
--
-- api/src/db/init.js does the same on boot, so running this by hand is only
-- needed to get ahead of a deploy.
--
-- Review then run: COMMIT;  (or ROLLBACK; to undo)
-- ==========================================================================

BEGIN;

ALTER TABLE meeting_vote_options
  ADD COLUMN IF NOT EXISTS is_abstain BOOLEAN NOT NULL DEFAULT false;

INSERT INTO meeting_vote_options (vote_id, option_text, display_order, is_abstain)
SELECT v.id, 'Abstain', COALESCE(MAX(o.display_order) + 1, 0), true
FROM meeting_votes v
LEFT JOIN meeting_vote_options o ON o.vote_id = v.id
WHERE v.status = 'open'
  AND NOT EXISTS (
    SELECT 1 FROM meeting_vote_options a WHERE a.vote_id = v.id AND a.is_abstain
  )
GROUP BY v.id;

COMMIT;
