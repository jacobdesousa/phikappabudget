const { loadAuthContext } = require("./auth");
const { writeAuditLog } = require("../utils/auditLog");

function isWriteMethod(method) {
  const m = String(method ?? "").toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

/**
 * Logs authenticated write requests as audit events.
 * Mount this AFTER requireAuth so req.auth is present.
 */
function auditWrites() {
  return function auditMiddleware(req, res, next) {
    if (!isWriteMethod(req.method)) return next();

    const startedAt = Date.now();
    res.on("finish", async () => {
      try {
        // Ensure we have actor context.
        let ctx = req.user;
        if (!ctx && req.auth?.userId) ctx = await loadAuthContext(req);
        if (!ctx) return;

        const ms = Date.now() - startedAt;
        await writeAuditLog({
          actor_user_id: ctx.id,
          actor_email: ctx.email,
          ip: req.ip,
          user_agent: req.headers["user-agent"],
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          action: "http.write",
          details: { ms },
        });
      } catch {
        // ignore
      }
    });

    next();
  };
}

module.exports = { auditWrites };


