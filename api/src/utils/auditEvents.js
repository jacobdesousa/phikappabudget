const { writeAuditLog } = require("./auditLog");

function baseFromReq(req) {
  return {
    ip: req.ip,
    user_agent: req.headers["user-agent"],
    method: req.method,
    path: req.originalUrl,
  };
}

// Who to record as the actor. During a "view as" session req.user is the target
// — that is what makes the app behave as them — so the log has to reach past it
// to the admin actually driving, and say whose account was being worn.
function actorFrom(ctx, fallbackEmail) {
  if (ctx?.impersonator) {
    return {
      actor_user_id: ctx.impersonator.id,
      actor_email: ctx.impersonator.email,
      viewing_as: { id: ctx.id, email: ctx.email },
    };
  }
  return {
    actor_user_id: ctx?.id ?? null,
    actor_email: ctx?.email ?? fallbackEmail ?? null,
    viewing_as: null,
  };
}

// Fold the impersonation marker into whatever details the caller passed, so no
// audit row can describe an action without saying it happened through a
// "view as" session.
function withViewingAs(details, viewing_as) {
  if (!viewing_as) return details;
  return { ...(details ?? {}), viewing_as };
}

async function auditAuthEvent(req, res, payload) {
  const ctx = req.user ?? null;
  const status = res?.statusCode ?? null;
  const { actor_user_id, actor_email, viewing_as } = actorFrom(ctx, payload?.actor_email);
  await writeAuditLog({
    ...baseFromReq(req),
    status,
    actor_user_id,
    actor_email,
    action: payload?.action ?? "auth.event",
    target_type: payload?.target_type ?? null,
    target_id: payload?.target_id ?? null,
    details: withViewingAs(payload?.details, viewing_as),
  });
}

async function auditAdminEvent(req, res, payload) {
  const ctx = req.user ?? null;
  const status = res?.statusCode ?? null;
  const { actor_user_id, actor_email, viewing_as } = actorFrom(ctx);
  await writeAuditLog({
    ...baseFromReq(req),
    status,
    actor_user_id,
    actor_email,
    action: payload?.action ?? "admin.event",
    target_type: payload?.target_type ?? null,
    target_id: payload?.target_id ?? null,
    details: withViewingAs(payload?.details, viewing_as),
  });
}

module.exports = { auditAuthEvent, auditAdminEvent };


