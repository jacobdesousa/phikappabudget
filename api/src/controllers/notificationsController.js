const { pool } = require("../db/pool");
const { loadAuthContext } = require("../middleware/auth");
const { buildFeed } = require("../services/notificationFeed");
const { todayInToronto } = require("../utils/schoolYear");
const { markReadSchema, previewQuerySchema } = require("../validation/notifications");

// A brother's own notifications. Never anyone else's: the only id this reads is
// ctx.brother_id, and the admin preview below is the single exception.
//
// No permission gate, like the shift feed it replaces — this is your own data,
// and a member with no officer permissions still needs to know they are on
// duty on Friday.

async function getNotifications(req, res) {
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });

  const asOf = todayInToronto();
  const brotherId = ctx.brother_id ?? null;
  const items = await buildFeed(brotherId, { asOf });

  return res.json({
    as_of: asOf,
    brother_id: brotherId,
    items,
    counts: countsFor(items),
  });
}

function countsFor(items) {
  const byKind = {};
  let unread = 0;
  for (const item of items) {
    byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;
    if (!item.read) unread += 1;
  }
  return { total: items.length, unread, by_kind: byKind };
}

// Marking read is an upsert on (brother_id, item_key): doing it twice is the
// same as doing it once, which matters because the page fires this on click
// and may race with its own refresh.
async function markNotificationsRead(req, res) {
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });
  if (!ctx.brother_id) return res.json({ ok: true, marked: 0 });

  const { keys, read } = markReadSchema.parse(req.body ?? {});

  if (read === false) {
    const { rowCount } = await pool.query(
      `DELETE FROM notification_reads WHERE brother_id = $1 AND item_key = ANY($2::text[])`,
      [ctx.brother_id, keys]
    );
    return res.json({ ok: true, marked: rowCount });
  }

  const { rowCount } = await pool.query(
    `INSERT INTO notification_reads (brother_id, item_key)
     SELECT $1, UNNEST($2::text[])
     ON CONFLICT (brother_id, item_key) DO NOTHING`,
    [ctx.brother_id, keys]
  );
  return res.json({ ok: true, marked: rowCount });
}

// "Mark all read" marks what the brother can currently see, rather than
// everything ever: an item that appears tomorrow should still arrive unread.
async function markAllNotificationsRead(req, res) {
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });
  if (!ctx.brother_id) return res.json({ ok: true, marked: 0 });

  const asOf = todayInToronto();
  const items = await buildFeed(ctx.brother_id, { asOf });
  const keys = items.filter((i) => !i.read).map((i) => i.key);
  if (keys.length === 0) return res.json({ ok: true, marked: 0 });

  const { rowCount } = await pool.query(
    `INSERT INTO notification_reads (brother_id, item_key)
     SELECT $1, UNNEST($2::text[])
     ON CONFLICT (brother_id, item_key) DO NOTHING`,
    [ctx.brother_id, keys]
  );
  return res.json({ ok: true, marked: rowCount });
}

// Somebody else's feed, for working out why a brother says they saw nothing.
// Admin-gated, and the only path that accepts a brother id from the request.
async function previewNotifications(req, res) {
  const q = previewQuerySchema.parse(req.query);
  const asOf = q.as_of ?? todayInToronto();
  const items = await buildFeed(q.brother_id, { asOf });
  return res.json({ as_of: asOf, brother_id: q.brother_id, items, counts: countsFor(items) });
}

module.exports = {
  getNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  previewNotifications,
};
