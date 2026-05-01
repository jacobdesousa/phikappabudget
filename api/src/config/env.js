require("dotenv").config();

function parseCorsOrigins(value) {
  if (!value) return ["http://localhost:3000"];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8080),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  appBaseUrl: String(process.env.APP_BASE_URL ?? "http://localhost:3000"),
  pg: {
    host: String(process.env.PGHOST ?? "localhost"),
    port: Number(process.env.PGPORT ?? 5432),
    database: String(process.env.PGDATABASE ?? "pks"),
    user: String(process.env.PGUSER ?? "pks"),
    // IMPORTANT:
    // If you don't set PGPASSWORD and your Postgres uses SCRAM auth,
    // the pg driver will error during SASL auth with "password must be a string".
    // We intentionally do NOT default this, so we can fail fast with a clearer message.
    password: process.env.PGPASSWORD,
  },
  auth: {
    jwtAccessSecret: String(process.env.JWT_ACCESS_SECRET ?? "dev-only-change-me"),
    jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900), // 15m
    refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS ?? 30),
    cookieName: String(process.env.REFRESH_COOKIE_NAME ?? "pks_refresh"),
  },
  mail: {
    provider: String(process.env.MAIL_PROVIDER ?? "dev"), // dev | ses (future)
    from: String(process.env.MAIL_FROM ?? "noreply@example.com"),
  },
  bootstrap: {
    adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL ? String(process.env.BOOTSTRAP_ADMIN_EMAIL) : null,
    adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD ? String(process.env.BOOTSTRAP_ADMIN_PASSWORD) : null,
  },
};

module.exports = { env };


