const crypto = require("crypto");
const { env } = require("../config/env");
const { verifyHs256, signHs256 } = require("../utils/jwt");
const { pool } = require("../db/pool");
const { computePermissions, normalizeRoleKey, ROLE_PERMISSIONS } = require("../utils/permissions");

function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function makeAccessToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Number(env.auth.jwtAccessTtlSeconds || 900);
  return signHs256({ sub: userId, iat: now, exp }, env.auth.jwtAccessSecret);
}

function requireAuth(req, res, next) {
  const auth = String(req.headers.authorization ?? "");
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: { message: "Unauthorized" } });
  const token = m[1];
  const result = verifyHs256(token, env.auth.jwtAccessSecret);
  if (!result.ok) return res.status(401).json({ error: { message: "Unauthorized" } });
  const userId = Number(result.payload?.sub);
  if (!Number.isFinite(userId) || userId <= 0) return res.status(401).json({ error: { message: "Unauthorized" } });
  req.auth = { userId };
  next();
}

async function loadAuthContext(req) {
  if (req.user) return req.user;
  const userId = req.auth?.userId;
  if (!userId) return null;

  const userRes = await pool.query(`SELECT id, email, status, brother_id FROM users WHERE id = $1`, [userId]);
  const u = userRes.rows?.[0];
  if (!u || u.status !== "active") return null;

  // Roles are derived from the brother's active office tenures in brother_offices.
  // This supports multiple simultaneous offices and historical records with start/end dates.
  let roles = [];
  if (u.brother_id) {
    const broRes = await pool.query(`SELECT status FROM brothers WHERE id = $1`, [u.brother_id]);
    const b = broRes.rows?.[0];
    try {
      const officesRes = await pool.query(
        `SELECT bo.office_key FROM brother_offices bo
         WHERE bo.brother_id = $1
           AND bo.start_date <= CURRENT_DATE
           AND (bo.end_date IS NULL OR bo.end_date >= CURRENT_DATE)`,
        [u.brother_id]
      );
      for (const r of officesRes.rows ?? []) {
        const key = normalizeRoleKey(r.office_key);
        if (key && !roles.includes(key)) roles.push(key);
      }
    } catch {
      // brother_offices table may not exist yet on first boot; skip silently
    }
    // Alumni get a baseline view-only role by status
    if (String(b?.status ?? "").toLowerCase().startsWith("alumn")) roles.push("alumni");
  } else {
    // Bootstrap / service users can still use explicit roles.
    const rolesRes = await pool.query(`SELECT role_key FROM user_roles WHERE user_id = $1`, [userId]);
    roles = rolesRes.rows.map((r) => r.role_key);
  }
  const overridesRes = await pool.query(`SELECT permission_key, effect FROM user_permission_overrides WHERE user_id = $1`, [userId]);
  const overrides = overridesRes.rows ?? [];

  // Prefer DB-backed role permissions if configured; fallback to code defaults.
  // This allows role permissions to be configured via admin UI.
  let rolePermsMap = null;
  try {
    const rpRes = await pool.query(
      `SELECT role_key, permission_key FROM role_permissions WHERE role_key = ANY($1::text[])`,
      [roles]
    );
    rolePermsMap = new Map();
    for (const r of rpRes.rows ?? []) {
      const k = String(r.role_key ?? "");
      if (!rolePermsMap.has(k)) rolePermsMap.set(k, []);
      rolePermsMap.get(k).push(r.permission_key);
    }
  } catch {
    rolePermsMap = null;
  }

  const effectiveRolePerms = {};
  for (const r of roles) {
    const key = String(r).toLowerCase();
    const fromDb = rolePermsMap?.get(key);
    if (fromDb && fromDb.length > 0) effectiveRolePerms[key] = fromDb;
    else effectiveRolePerms[key] = ROLE_PERMISSIONS[key] ?? [];
  }

  const permissions = computePermissions({ roles, overrides, rolePermissions: effectiveRolePerms });

  req.user = {
    id: u.id,
    email: u.email,
    brother_id: u.brother_id,
    roles,
    permissions,
  };
  return req.user;
}

function requirePermission(permissionKey) {
  return async function permissionMiddleware(req, res, next) {
    const ctx = await loadAuthContext(req);
    if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });
    if (!ctx.permissions.includes(permissionKey)) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }
    next();
  };
}

async function issueRefreshToken({ userId, userAgent, ip }) {
  const raw = crypto.randomBytes(32).toString("hex");
  const token_hash = hashToken(raw);
  const expires_at = new Date(Date.now() + Number(env.auth.refreshTtlDays || 30) * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, expires_at, user_agent, ip) VALUES ($1, $2, $3, $4, $5)`,
    [token_hash, userId, expires_at, userAgent ?? null, ip ?? null]
  );
  return { raw, expires_at };
}

async function rotateRefreshToken(rawToken, { userAgent, ip }) {
  const token_hash = hashToken(rawToken);
  const res = await pool.query(
    `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
    [token_hash]
  );
  const row = res.rows?.[0];
  if (!row) return { ok: false };
  if (row.revoked_at) return { ok: false };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return { ok: false };

  await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);
  const next = await issueRefreshToken({ userId: row.user_id, userAgent, ip });
  return { ok: true, userId: row.user_id, next };
}

function getRefreshCookie(req) {
  const cookies = parseCookies(req);
  return cookies[env.auth.cookieName] ?? null;
}

function setRefreshCookie(res, rawToken, expiresAt) {
  const secure = env.nodeEnv === "production";
  res.cookie(env.auth.cookieName, rawToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

function clearRefreshCookie(res) {
  const secure = env.nodeEnv === "production";
  res.cookie(env.auth.cookieName, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

module.exports = {
  requireAuth,
  requirePermission,
  loadAuthContext,
  makeAccessToken,
  getRefreshCookie,
  rotateRefreshToken,
  issueRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  hashToken,
};


