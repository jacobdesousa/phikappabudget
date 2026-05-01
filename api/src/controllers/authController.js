const crypto = require("crypto");
const { pool } = require("../db/pool");
const { env } = require("../config/env");
const { hashPassword, verifyPassword } = require("../utils/password");
const {
  makeAccessToken,
  issueRefreshToken,
  setRefreshCookie,
  getRefreshCookie,
  rotateRefreshToken,
  clearRefreshCookie,
  hashToken,
  loadAuthContext,
} = require("../middleware/auth");
const { auditAuthEvent, auditAdminEvent } = require("../utils/auditEvents");

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function devLog(label, value) {
  if (env.nodeEnv === "production") return;
  // eslint-disable-next-line no-console
  console.log(`[dev-mail] ${label}: ${value}`);
}

async function login(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: { message: "Email and password are required." } });

  const userRes = await pool.query(`SELECT id, email, password_hash, status FROM users WHERE email = $1`, [email]);
  const u = userRes.rows?.[0];
  if (!u || u.status !== "active") {
    await auditAuthEvent(req, res, { action: "auth.login.failed", actor_email: email, details: { reason: "invalid" } });
    return res.status(401).json({ error: { message: "Invalid credentials" } });
  }
  if (!verifyPassword(password, u.password_hash)) {
    await auditAuthEvent(req, res, { action: "auth.login.failed", actor_email: email, details: { reason: "invalid" } });
    return res.status(401).json({ error: { message: "Invalid credentials" } });
  }

  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [u.id]);

  const access_token = makeAccessToken(u.id);
  const rt = await issueRefreshToken({
    userId: u.id,
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  setRefreshCookie(res, rt.raw, rt.expires_at);

  // return effective permissions for UI convenience
  req.auth = { userId: u.id };
  const me = await loadAuthContext(req);

  await auditAuthEvent(req, res, { action: "auth.login.success", target_type: "user", target_id: String(u.id) });

  return res.status(200).json({
    access_token,
    user: me ? { id: me.id, email: me.email, roles: me.roles, permissions: me.permissions } : { id: u.id, email: u.email },
  });
}

async function refresh(req, res) {
  const raw = getRefreshCookie(req);
  if (!raw) {
    await auditAuthEvent(req, res, { action: "auth.refresh.failed", details: { reason: "no_cookie" } });
    return res.status(401).json({ error: { message: "Unauthorized" } });
  }

  const rotated = await rotateRefreshToken(raw, { userAgent: req.headers["user-agent"], ip: req.ip });
  if (!rotated.ok) {
    await auditAuthEvent(req, res, { action: "auth.refresh.failed", details: { reason: "rotate_failed" } });
    return res.status(401).json({ error: { message: "Unauthorized" } });
  }

  const access_token = makeAccessToken(rotated.userId);
  setRefreshCookie(res, rotated.next.raw, rotated.next.expires_at);

  req.auth = { userId: rotated.userId };
  const me = await loadAuthContext(req);

  await auditAuthEvent(req, res, { action: "auth.refresh.success", target_type: "user", target_id: String(rotated.userId) });

  return res.status(200).json({
    access_token,
    user: me ? { id: me.id, email: me.email, roles: me.roles, permissions: me.permissions } : { id: rotated.userId },
  });
}

async function logout(req, res) {
  const raw = getRefreshCookie(req);
  if (raw) {
    await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [hashToken(raw)]);
  }
  clearRefreshCookie(res);
  await auditAuthEvent(req, res, { action: "auth.logout" });
  return res.status(200).json({ ok: true });
}

async function me(req, res) {
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });
  return res.status(200).json({ id: ctx.id, email: ctx.email, roles: ctx.roles, permissions: ctx.permissions });
}

async function inviteUser(req, res) {
  const brother_id = Number(req.body?.brother_id);
  if (!Number.isFinite(brother_id) || brother_id <= 0) {
    return res.status(400).json({ error: { message: "brother_id is required." } });
  }

  const broRes = await pool.query(`SELECT id, email FROM brothers WHERE id = $1`, [brother_id]);
  const b = broRes.rows?.[0];
  if (!b) return res.status(404).json({ error: { message: "Brother not found." } });

  const email = normalizeEmail(b.email);
  if (!email) return res.status(400).json({ error: { message: "Selected brother does not have an email set." } });

  // Prevent inviting if user already exists
  const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows?.[0]?.id) return res.status(400).json({ error: { message: "A user with this email already exists." } });

  const rawToken = crypto.randomBytes(24).toString("hex");
  const token_hash = hashToken(rawToken);
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await pool.query(
    `INSERT INTO invite_tokens (token_hash, email, brother_id, roles_json, expires_at, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    // Roles are derived from the brother's office at runtime; keep roles_json for schema compatibility.
    [token_hash, email, brother_id, "[]", expires_at, req.user?.id ?? req.auth?.userId ?? null]
  );

  const inviteUrl = `${env.appBaseUrl.replace(/\/$/, "")}/invite/${rawToken}`;
  devLog("INVITE_LINK", inviteUrl);
  await auditAdminEvent(req, res, {
    action: "admin.invite.create",
    target_type: "brother",
    target_id: String(brother_id),
    details: { email },
  });

  // In dev mode, return the URL to make setup easy.
  const payload = { ok: true };
  if (env.mail.provider === "dev" && env.nodeEnv !== "production") payload.invite_url = inviteUrl;

  return res.status(200).json(payload);
}

async function acceptInvite(req, res) {
  const token = String(req.body?.token ?? "");
  const password = String(req.body?.password ?? "");
  if (!token || !password) return res.status(400).json({ error: { message: "Token and password are required." } });

  const token_hash = hashToken(token);
  const inviteRes = await pool.query(
    `SELECT id, email, brother_id, roles_json, expires_at, used_at, revoked_at FROM invite_tokens WHERE token_hash = $1`,
    [token_hash]
  );
  const inv = inviteRes.rows?.[0];
  if (!inv) return res.status(400).json({ error: { message: "Invite link is invalid." } });
  if (inv.used_at) return res.status(400).json({ error: { message: "Invite link was already used." } });
  if (inv.revoked_at) return res.status(400).json({ error: { message: "Invite link was revoked." } });
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return res.status(400).json({ error: { message: "Invite link has expired." } });

  // Email/role are sourced from the linked brother record (single source of truth).
  if (!inv.brother_id) return res.status(400).json({ error: { message: "Invite is missing a linked brother." } });
  const broRes = await pool.query(`SELECT email FROM brothers WHERE id = $1`, [inv.brother_id]);
  const b = broRes.rows?.[0];
  const email = normalizeEmail(b?.email ?? inv.email);
  if (!email) return res.status(400).json({ error: { message: "Brother email is missing; set it before accepting invite." } });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows?.[0]?.id) {
      await client.query(`UPDATE invite_tokens SET used_at = NOW() WHERE id = $1`, [inv.id]);
      await client.query("COMMIT");
      return res.status(400).json({ error: { message: "A user with this email already exists." } });
    }

    const pwHash = hashPassword(password);
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, brother_id) VALUES ($1, $2, $3) RETURNING id, email`,
      [email, pwHash, inv.brother_id ? Number(inv.brother_id) : null]
    );
    const userId = userRes.rows[0].id;

    // Roles are derived from brother_offices tenures; no separate role assignment needed here.

    await client.query(`UPDATE invite_tokens SET used_at = NOW() WHERE id = $1`, [inv.id]);

    await client.query("COMMIT");

    // Auto-login after accepting invite
    const access_token = makeAccessToken(userId);
    const rt = await issueRefreshToken({
      userId,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    setRefreshCookie(res, rt.raw, rt.expires_at);

    req.auth = { userId };
    const me = await loadAuthContext(req);

    return res.status(200).json({
      access_token,
      user: me ? { id: me.id, email: me.email, roles: me.roles, permissions: me.permissions } : { id: userId, email },
    });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function devPasswordResetRequest(req, res) {
  // Phase 1: just a dev-only helper to avoid blocking login testing.
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(200).json({ ok: true });
  const userRes = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  const u = userRes.rows?.[0];
  if (!u) return res.status(200).json({ ok: true });

  const raw = crypto.randomBytes(24).toString("hex");
  const url = `${env.appBaseUrl.replace(/\/$/, "")}/reset-password/${raw}`;
  devLog("RESET_LINK", url);
  return res.status(200).json({ ok: true, reset_url: env.nodeEnv !== "production" ? url : undefined });
}

async function listInvites(req, res) {
  const result = await pool.query(
    `
      SELECT
        i.id,
        i.email,
        i.brother_id,
        i.expires_at,
        i.used_at,
        i.revoked_at,
        i.created_at,
        i.created_by_user_id,
        b.first_name AS brother_first_name,
        b.last_name AS brother_last_name,
        b.status AS brother_status,
        u.email AS created_by_email
      FROM invite_tokens i
      LEFT JOIN brothers b ON b.id = i.brother_id
      LEFT JOIN users u ON u.id = i.created_by_user_id
      ORDER BY i.created_at DESC
      LIMIT 200
    `
  );
  return res.status(200).json(result.rows);
}

async function revokeInvite(req, res) {
  const id = Number(req.params?.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: { message: "Invalid invite id." } });
  const updated = await pool.query(
    `UPDATE invite_tokens SET revoked_at = NOW() WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL RETURNING id`,
    [id]
  );
  if (!updated.rows?.[0]?.id) return res.status(404).json({ error: { message: "Invite not found (or already used/revoked)." } });
  await auditAdminEvent(req, res, { action: "admin.invite.revoke", target_type: "invite", target_id: String(id) });
  return res.status(200).json({ ok: true });
}

async function reissueInvite(req, res) {
  const id = Number(req.params?.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: { message: "Invalid invite id." } });

  const invRes = await pool.query(`SELECT id, email, brother_id, used_at FROM invite_tokens WHERE id = $1`, [id]);
  const inv = invRes.rows?.[0];
  if (!inv) return res.status(404).json({ error: { message: "Invite not found." } });
  if (inv.used_at) return res.status(400).json({ error: { message: "Invite was already used." } });
  if (!inv.brother_id) return res.status(400).json({ error: { message: "Invite is missing a linked brother." } });

  // Revoke old invite and create a new token.
  await pool.query(`UPDATE invite_tokens SET revoked_at = NOW() WHERE id = $1`, [id]);

  const rawToken = crypto.randomBytes(24).toString("hex");
  const token_hash = hashToken(rawToken);
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO invite_tokens (token_hash, email, brother_id, roles_json, expires_at, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [token_hash, normalizeEmail(inv.email), Number(inv.brother_id), "[]", expires_at, req.user?.id ?? req.auth?.userId ?? null]
  );

  const inviteUrl = `${env.appBaseUrl.replace(/\/$/, "")}/invite/${rawToken}`;
  devLog("INVITE_REISSUE_LINK", inviteUrl);
  await auditAdminEvent(req, res, { action: "admin.invite.reissue", target_type: "invite", target_id: String(id), details: { email: inv.email } });

  const payload = { ok: true };
  if (env.mail.provider === "dev" && env.nodeEnv !== "production") payload.invite_url = inviteUrl;
  return res.status(200).json(payload);
}

module.exports = {
  login,
  refresh,
  logout,
  me,
  inviteUser,
  acceptInvite,
  devPasswordResetRequest,
  listInvites,
  revokeInvite,
  reissueInvite,
};


