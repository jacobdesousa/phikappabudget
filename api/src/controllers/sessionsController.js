const { pool } = require("../db/pool");
const { getRefreshCookie, hashToken, clearRefreshCookie } = require("../middleware/auth");
const { auditAuthEvent } = require("../utils/auditEvents");

async function listSessions(req, res) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

  const raw = getRefreshCookie(req);
  const currentHash = raw ? hashToken(raw) : null;
  const currentRes = currentHash
    ? await pool.query(`SELECT id FROM refresh_tokens WHERE token_hash = $1`, [currentHash])
    : { rows: [] };
  const current_session_id = currentRes.rows?.[0]?.id ?? null;

  const result = await pool.query(
    `
      SELECT id, created_at, expires_at, revoked_at, user_agent, ip
      FROM refresh_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [userId]
  );

  const sessions = (result.rows ?? []).map((s) => ({
    ...s,
    is_current: current_session_id ? Number(s.id) === Number(current_session_id) : false,
  }));

  return res.status(200).json({ current_session_id, sessions });
}

async function revokeSession(req, res) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

  const id = Number(req.params?.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: { message: "Invalid session id." } });

  const updated = await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
      RETURNING id
    `,
    [id, userId]
  );
  if (!updated.rows?.[0]?.id) return res.status(404).json({ error: { message: "Session not found." } });

  // If revoking the current session, clear cookie too.
  const raw = getRefreshCookie(req);
  if (raw) {
    const currentHash = hashToken(raw);
    const currentRes = await pool.query(`SELECT id FROM refresh_tokens WHERE token_hash = $1`, [currentHash]);
    const currentId = currentRes.rows?.[0]?.id ?? null;
    if (currentId && Number(currentId) === id) clearRefreshCookie(res);
  }

  await auditAuthEvent(req, res, {
    action: "auth.session.revoke",
    target_type: "refresh_token",
    target_id: String(id),
  });

  return res.status(200).json({ ok: true });
}

async function revokeAllSessions(req, res) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

  const keepCurrent = req.body?.keep_current !== false;

  let currentId = null;
  const raw = getRefreshCookie(req);
  if (raw) {
    const currentHash = hashToken(raw);
    const currentRes = await pool.query(`SELECT id FROM refresh_tokens WHERE token_hash = $1`, [currentHash]);
    currentId = currentRes.rows?.[0]?.id ?? null;
  }

  const where = keepCurrent && currentId ? `AND id <> $2` : "";
  const params = keepCurrent && currentId ? [userId, Number(currentId)] : [userId];

  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL
      ${where}
    `,
    params
  );

  if (!keepCurrent) clearRefreshCookie(res);

  await auditAuthEvent(req, res, {
    action: "auth.session.revoke_all",
    target_type: "user",
    target_id: String(userId),
    details: { keep_current: Boolean(keepCurrent), current_session_id: currentId },
  });

  return res.status(200).json({ ok: true });
}

module.exports = { listSessions, revokeSession, revokeAllSessions };


