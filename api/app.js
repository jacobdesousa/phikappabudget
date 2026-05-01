const { env } = require("./src/config/env");
const { createApp } = require("./src/app");
const { setupTables } = require("./src/db/init");

async function main() {
  // If your Postgres auth method is SCRAM (common default), a password is required.
  // Without it, the pg driver throws a confusing SASL error ("password must be a string").
  if (!env.pg.password) {
    throw new Error(
      "Missing Postgres password. Set PGPASSWORD in your environment (see api/env.example). " +
        "If you use .pgpass instead, ensure it contains an entry for this connection."
    );
  }

  await setupTables();
  const app = createApp();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on port ${env.port}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
