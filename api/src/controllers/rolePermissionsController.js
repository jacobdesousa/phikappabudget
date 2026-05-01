const { pool } = require("../db/pool");
const { auditAdminEvent } = require("../utils/auditEvents");
const { ROLE_PERMISSIONS } = require("../utils/permissions");

function allPermissionKeysFromDefaults() {
  const set = new Set();
  for (const perms of Object.values(ROLE_PERMISSIONS ?? {})) {
    for (const p of perms ?? []) set.add(p);
  }
  return Array.from(set).sort();
}

function normalizeRoleKey(value) {
  const k = String(value ?? "").trim().toLowerCase();
  return k || null;
}

async function listRolePermissions(req, res) {
  const officeRes = await pool.query(`SELECT office_key, display_name FROM offices ORDER BY display_name ASC`);
  const offices = (officeRes.rows ?? []).map((o) => ({
    office_key: String(o.office_key ?? "").toLowerCase(),
    display_name: String(o.display_name ?? ""),
  }));

  const rpRes = await pool.query(`SELECT role_key, permission_key FROM role_permissions ORDER BY role_key, permission_key`);
  const map = new Map();
  for (const r of rpRes.rows ?? []) {
    const role = String(r.role_key ?? "").toLowerCase();
    if (!map.has(role)) map.set(role, []);
    map.get(role).push(String(r.permission_key));
  }

  const role_permissions = offices.map((o) => ({
    role_key: o.office_key,
    display_name: o.display_name,
    permissions: (map.get(o.office_key) ?? ROLE_PERMISSIONS[o.office_key] ?? []).slice().sort(),
  }));

  return res.status(200).json({
    offices,
    permission_keys: allPermissionKeysFromDefaults(),
    role_permissions,
  });
}

async function updateRolePermissions(req, res) {
  const role_key = normalizeRoleKey(req.params?.roleKey);
  if (!role_key) return res.status(400).json({ error: { message: "Invalid role key." } });
  const officeExists = await pool.query(`SELECT 1 FROM offices WHERE office_key = $1 LIMIT 1`, [role_key]);
  if (!officeExists.rows?.[0]) return res.status(400).json({ error: { message: "Unknown office key." } });

  const allowed = new Set(allPermissionKeysFromDefaults());
  const perms = Array.isArray(req.body?.permissions) ? req.body.permissions : null;
  if (!perms) return res.status(400).json({ error: { message: "permissions must be an array." } });

  const cleaned = [];
  for (const p of perms) {
    const key = String(p ?? "").trim();
    if (!key) continue;
    if (!allowed.has(key)) return res.status(400).json({ error: { message: `Unknown permission key: ${key}` } });
    cleaned.push(key);
  }
  const unique = Array.from(new Set(cleaned)).sort();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM role_permissions WHERE role_key = $1`, [role_key]);
    for (const p of unique) {
      await client.query(`INSERT INTO role_permissions (role_key, permission_key) VALUES ($1, $2)`, [role_key, p]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await auditAdminEvent(req, res, {
    action: "admin.role_permissions.update",
    target_type: "role",
    target_id: role_key,
    details: { permissions: unique },
  });

  return res.status(200).json({ ok: true, role_key, permissions: unique });
}

module.exports = { listRolePermissions, updateRolePermissions };


