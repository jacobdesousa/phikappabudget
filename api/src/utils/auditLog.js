const { pool } = require("../db/pool");

function safeJsonStringify(value) {
  try {
    if (value === undefined) return null;
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Best-effort audit logger. Never throws (to avoid breaking requests).
 */
async function writeAuditLog(payload) {
  try {
    const {
      actor_user_id = null,
      actor_email = null,
      ip = null,
      user_agent = null,
      method = null,
      path = null,
      status = null,
      action = null,
      target_type = null,
      target_id = null,
      details = undefined,
    } = payload ?? {};

    const details_json = safeJsonStringify(details);

    await pool.query(
      `
        INSERT INTO audit_log
          (actor_user_id, actor_email, ip, user_agent, method, path, status, action, target_type, target_id, details_json)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        actor_user_id,
        actor_email,
        ip,
        user_agent,
        method,
        path,
        status,
        action,
        target_type,
        target_id,
        details_json,
      ]
    );
  } catch {
    // ignore
  }
}

module.exports = { writeAuditLog };


