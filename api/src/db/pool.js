const dns = require("dns");
const { Pool } = require("pg");
const { env } = require("../config/env");

// Neon's host resolves to both IPv6 and IPv4. Node 18 tries the addresses in
// DNS order, which puts IPv6 first, and hangs for the full ~75s OS TCP timeout
// on any network that can't route it.
dns.setDefaultResultOrder("ipv4first");

const pool = new Pool({
  ...env.pg,
  // Fail fast rather than sitting on the OS timeout.
  connectionTimeoutMillis: 10000,
});

// Errors on clients that aren't checked out — a dropped idle connection, or a
// background connect — arrive as an 'error' event with no request attached.
// Without a listener that's an unhandled EventEmitter error, which takes the
// whole process down; Neon suspends idle compute, so this is routine.
//
// Errors *during* a query still reject that query's promise and surface as a
// 500 through the error handler. Nothing here retries.
pool.on("error", (err) => {
  console.error("[pg] idle client error:", err.message);
});

module.exports = { pool };
