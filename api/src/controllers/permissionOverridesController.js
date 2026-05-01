const { pool } = require("../db/pool");
const { auditAdminEvent } = require("../utils/auditEvents");
const { computePermissions, normalizeRoleKey } = require("../utils/permissions");

function normalizeKey(value) {
  const k = String(value ?? "").trim();
  return k || null;
}

function normalizeEffect(value) {
  const e = String(value ?? "").trim().toLowerCase();
  if (e === "allow" || e === "deny") return e;
  return null;
}

async function listUsers(req, res) {
  const usersRes = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.status,
        u.brother_id,
        u.last_login_at,
        u.created_at,
        b.first_name AS brother_first_name,
        b.last_name AS brother_last_name,
        b.status AS brother_status
      FROM users u
      LEFT JOIN brothers b ON b.id = u.brother_id
      ORDER BY u.email ASC
      LIMIT 500
    `
  );

  const users = usersRes.rows ?? [];
  const userIds = users.map((u) => Number(u.id)).filter((n) => Number.isFinite(n) && n > 0);

  // Active office tenures from brother_offices (replaces brothers.office for role derivation)
  const brotherIds = users.filter((u) => u.brother_id).map((u) => Number(u.brother_id)).filter((n) => Number.isFinite(n) && n > 0);
  const activeOfficesRes =
    brotherIds.length > 0
      ? await pool.query(
          `SELECT brother_id, array_agg(office_key) AS office_keys
           FROM brother_offices
           WHERE brother_id = ANY($1::int[])
             AND start_date <= CURRENT_DATE
             AND (end_date IS NULL OR end_date >= CURRENT_DATE)
           GROUP BY brother_id`,
          [brotherIds]
        )
      : { rows: [] };
  const activeOfficesByBrotherId = new Map();
  for (const r of activeOfficesRes.rows ?? []) {
    activeOfficesByBrotherId.set(Number(r.brother_id), r.office_keys ?? []);
  }

  // Explicit roles (only used for users without brother_id / bootstrap users)
  const noBrotherIds = users.filter((u) => !u.brother_id).map((u) => Number(u.id)).filter((n) => Number.isFinite(n) && n > 0);
  const rolesRes =
    noBrotherIds.length > 0
      ? await pool.query(`SELECT user_id, role_key FROM user_roles WHERE user_id = ANY($1::int[])`, [noBrotherIds])
      : { rows: [] };
  const rolesByUserId = new Map();
  for (const r of rolesRes.rows ?? []) {
    const uid = Number(r.user_id);
    if (!rolesByUserId.has(uid)) rolesByUserId.set(uid, []);
    rolesByUserId.get(uid).push(r.role_key);
  }

  // Permission overrides
  const overridesRes =
    userIds.length > 0
      ? await pool.query(
          `SELECT user_id, permission_key, effect FROM user_permission_overrides WHERE user_id = ANY($1::int[])`,
          [userIds]
        )
      : { rows: [] };
  const overridesByUserId = new Map();
  for (const o of overridesRes.rows ?? []) {
    const uid = Number(o.user_id);
    if (!overridesByUserId.has(uid)) overridesByUserId.set(uid, []);
    overridesByUserId.get(uid).push({ permission_key: o.permission_key, effect: o.effect });
  }

  const out = users.map((u) => {
    const uid = Number(u.id);
    let roles = [];
    if (u.brother_id) {
      const keys = activeOfficesByBrotherId.get(Number(u.brother_id)) ?? [];
      roles = keys.map((k) => normalizeRoleKey(k)).filter(Boolean);
      if (String(u.brother_status ?? "").toLowerCase().startsWith("alumn")) roles.push("alumni");
    } else {
      roles = rolesByUserId.get(uid) ?? [];
    }
    roles = Array.from(new Set(roles));
    const overrides = overridesByUserId.get(uid) ?? [];
    const permissions = computePermissions({ roles, overrides });

    return {
      ...u,
      roles,
      permissions,
      overrides_count: overrides.length,
    };
  });

  return res.status(200).json(out);
}

async function listOverrides(req, res) {
  const userId = Number(req.params?.userId);
  if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: { message: "Invalid user id." } });

  const result = await pool.query(
    `
      SELECT user_id, permission_key, effect, created_by_user_id, created_at
      FROM user_permission_overrides
      WHERE user_id = $1
      ORDER BY permission_key ASC
    `,
    [userId]
  );
  return res.status(200).json(result.rows ?? []);
}

async function upsertOverride(req, res) {
  const userId = Number(req.params?.userId);
  if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: { message: "Invalid user id." } });

  const permission_key = normalizeKey(req.body?.permission_key);
  const effect = normalizeEffect(req.body?.effect);
  if (!permission_key) return res.status(400).json({ error: { message: "permission_key is required." } });
  if (!effect) return res.status(400).json({ error: { message: "effect must be 'allow' or 'deny'." } });

  await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]); // best-effort existence check

  await pool.query(
    `
      INSERT INTO user_permission_overrides (user_id, permission_key, effect, created_by_user_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, permission_key)
      DO UPDATE SET effect = EXCLUDED.effect, created_by_user_id = EXCLUDED.created_by_user_id, created_at = NOW()
    `,
    [userId, permission_key, effect, req.user?.id ?? null]
  );

  await auditAdminEvent(req, res, {
    action: "admin.permission_override.upsert",
    target_type: "user",
    target_id: String(userId),
    details: { permission_key, effect },
  });

  return res.status(200).json({ ok: true });
}

async function deleteOverride(req, res) {
  const userId = Number(req.params?.userId);
  if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: { message: "Invalid user id." } });

  const permission_key = normalizeKey(req.params?.permissionKey);
  if (!permission_key) return res.status(400).json({ error: { message: "Invalid permission key." } });

  const deleted = await pool.query(
    `
      DELETE FROM user_permission_overrides
      WHERE user_id = $1 AND permission_key = $2
      RETURNING user_id, permission_key
    `,
    [userId, permission_key]
  );
  if (!deleted.rows?.[0]?.permission_key) return res.status(404).json({ error: { message: "Override not found." } });

  await auditAdminEvent(req, res, {
    action: "admin.permission_override.delete",
    target_type: "user",
    target_id: String(userId),
    details: { permission_key },
  });

  return res.status(200).json({ ok: true });
}

async function updateUserStatus(req, res) {
  const userId = Number(req.params?.userId);
  if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: { message: "Invalid user id." } });

  const statusRaw = String(req.body?.status ?? "").trim().toLowerCase();
  if (statusRaw !== "active" && statusRaw !== "disabled") {
    return res.status(400).json({ error: { message: "status must be 'active' or 'disabled'." } });
  }

  const updated = await pool.query(
    `UPDATE users SET status = $2 WHERE id = $1 RETURNING id, email, status`,
    [userId, statusRaw]
  );
  const u = updated.rows?.[0];
  if (!u) return res.status(404).json({ error: { message: "User not found." } });

  await auditAdminEvent(req, res, {
    action: "admin.user.status.update",
    target_type: "user",
    target_id: String(userId),
    details: { status: statusRaw },
  });

  return res.status(200).json({ ok: true, user: u });
}

module.exports = { listUsers, listOverrides, upsertOverride, deleteOverride, updateUserStatus };


