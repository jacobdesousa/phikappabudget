const { pool } = require("../db/pool");
const { emailLogQuerySchema } = require("../validation/emailLog");

// Reading the email log. Writing happens in utils/mailer.js — nothing else
// should ever insert here, or the log stops being a record of what was sent.

// Keyset pagination on id: the list is strictly newest-first and ids are
// monotonic, so a cursor cannot skip or repeat rows the way an OFFSET does
// while new mail is arriving.
async function listEmailLog(req, res) {
  const q = emailLogQuerySchema.parse(req.query);

  const where = [];
  const values = [];

  if (q.kind) {
    values.push(q.kind);
    where.push(`e.kind = $${values.length}`);
  }
  if (q.status) {
    values.push(q.status);
    where.push(`e.status = $${values.length}`);
  }
  if (q.from) {
    values.push(q.from);
    where.push(`e.created_at >= $${values.length}::date`);
  }
  if (q.to) {
    // Inclusive of the whole end day, which is what a date picker implies.
    values.push(q.to);
    where.push(`e.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }
  if (q.q) {
    values.push(`%${q.q}%`);
    where.push(`(e.to_email ILIKE $${values.length} OR e.subject ILIKE $${values.length})`);
  }
  // The filters are shared by both queries; only the page query adds the
  // cursor and limit, so the counts stay over the whole filtered set.
  const filterWhere = where.slice();
  const filterValues = values.slice();

  if (q.cursor) {
    values.push(q.cursor);
    where.push(`e.id < $${values.length}`);
  }
  values.push(q.limit + 1);
  const limitPlaceholder = `$${values.length}`;

  const [pageRes, countsRes] = await Promise.all([
    pool.query(
      `SELECT e.id, e.created_at, e.sent_at, e.kind, e.to_email, e.subject, e.status,
              e.provider_message_id, e.error, e.attachments, e.dedupe_key,
              e.brother_id, b.first_name, b.last_name
       FROM email_log e
       LEFT JOIN brothers b ON b.id = e.brother_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY e.id DESC
       LIMIT ${limitPlaceholder}`,
      values
    ),
    // "3 failed" has to mean three in total, not three on this page.
    pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM email_log e
       ${filterWhere.length ? `WHERE ${filterWhere.join(" AND ")}` : ""}
       GROUP BY status`,
      filterValues
    ),
  ]);

  const hasMore = pageRes.rows.length > q.limit;
  const page = hasMore ? pageRes.rows.slice(0, q.limit) : pageRes.rows;

  return res.json({
    rows: page,
    next_cursor: hasMore ? page[page.length - 1].id : null,
    counts: Object.fromEntries(countsRes.rows.map((r) => [r.status, r.count])),
  });
}

// The body is only loaded one row at a time: it is the largest column and the
// list never needs it.
async function getEmailLogEntry(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: { message: "Invalid id" } });
  }

  const { rows } = await pool.query(
    `SELECT e.*, b.first_name, b.last_name, u.email AS user_email, a.email AS actor_email
     FROM email_log e
     LEFT JOIN brothers b ON b.id = e.brother_id
     LEFT JOIN users u ON u.id = e.user_id
     LEFT JOIN users a ON a.id = e.actor_user_id
     WHERE e.id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: { message: "Not found" } });

  return res.json(row);
}

module.exports = { listEmailLog, getEmailLogEntry };
