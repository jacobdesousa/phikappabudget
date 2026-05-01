const { pool } = require("../db/pool");
const { auditAdminEvent } = require("../utils/auditEvents");

function normalizeKey(value) {
  const k = String(value ?? "").trim().toLowerCase();
  return k || null;
}

function normalizeDisplayName(value) {
  const s = String(value ?? "").trim();
  return s || null;
}

async function listOffices(req, res) {
  const result = await pool.query(
    `SELECT office_key, display_name, created_at FROM offices ORDER BY display_name ASC`
  );
  return res.status(200).json(result.rows ?? []);
}

async function createOffice(req, res) {
  const office_key = normalizeKey(req.body?.office_key);
  const display_name = normalizeDisplayName(req.body?.display_name) ?? (office_key ? office_key.charAt(0).toUpperCase() + office_key.slice(1) : null);
  if (!office_key) return res.status(400).json({ error: { message: "office_key is required." } });
  if (!display_name) return res.status(400).json({ error: { message: "display_name is required." } });

  const exists = await pool.query(`SELECT 1 FROM offices WHERE office_key = $1 LIMIT 1`, [office_key]);
  if (exists.rows?.[0]) return res.status(400).json({ error: { message: "Office already exists." } });

  await pool.query(`INSERT INTO offices (office_key, display_name) VALUES ($1, $2)`, [office_key, display_name]);

  await auditAdminEvent(req, res, {
    action: "admin.office.create",
    target_type: "office",
    target_id: office_key,
    details: { display_name },
  });

  return res.status(200).json({ ok: true });
}

async function deleteOffice(req, res) {
  const office_key = normalizeKey(req.params?.officeKey);
  if (!office_key) return res.status(400).json({ error: { message: "Invalid office key." } });

  // Prevent deleting an office that has active (or historical) tenures.
  const inUse = await pool.query(
    `SELECT COUNT(*)::int AS c FROM brother_offices WHERE office_key = $1`,
    [office_key]
  );
  const count = inUse.rows?.[0]?.c ?? 0;
  if (count > 0) {
    return res.status(400).json({ error: { message: `Office has ${count} tenure record(s). Remove all tenures first.` } });
  }

  const deleted = await pool.query(`DELETE FROM offices WHERE office_key = $1 RETURNING office_key`, [office_key]);
  if (!deleted.rows?.[0]?.office_key) return res.status(404).json({ error: { message: "Office not found." } });

  // Also remove any permissions mapping for this role key.
  await pool.query(`DELETE FROM role_permissions WHERE role_key = $1`, [office_key]);

  await auditAdminEvent(req, res, {
    action: "admin.office.delete",
    target_type: "office",
    target_id: office_key,
  });

  return res.status(200).json({ ok: true });
}

module.exports = { listOffices, createOffice, deleteOffice };


