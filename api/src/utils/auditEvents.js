const { writeAuditLog } = require("./auditLog");

function baseFromReq(req) {
  return {
    ip: req.ip,
    user_agent: req.headers["user-agent"],
    method: req.method,
    path: req.originalUrl,
  };
}

async function auditAuthEvent(req, res, payload) {
  const ctx = req.user ?? null;
  const status = res?.statusCode ?? null;
  await writeAuditLog({
    ...baseFromReq(req),
    status,
    actor_user_id: ctx?.id ?? null,
    actor_email: ctx?.email ?? payload?.actor_email ?? null,
    action: payload?.action ?? "auth.event",
    target_type: payload?.target_type ?? null,
    target_id: payload?.target_id ?? null,
    details: payload?.details ?? undefined,
  });
}

async function auditAdminEvent(req, res, payload) {
  const ctx = req.user ?? null;
  const status = res?.statusCode ?? null;
  await writeAuditLog({
    ...baseFromReq(req),
    status,
    actor_user_id: ctx?.id ?? null,
    actor_email: ctx?.email ?? null,
    action: payload?.action ?? "admin.event",
    target_type: payload?.target_type ?? null,
    target_id: payload?.target_id ?? null,
    details: payload?.details ?? undefined,
  });
}

module.exports = { auditAuthEvent, auditAdminEvent };


