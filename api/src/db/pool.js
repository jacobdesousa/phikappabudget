const dns = require("dns");
const { Pool, types } = require("pg");
const { env } = require("../config/env");

// A DATE column is a calendar date, not an instant, and it must stay one all
// the way to the browser.
//
// By default pg turns DATE into a JS Date at the *server's* local midnight,
// which JSON then serializes as an instant — "2026-09-07T00:00:00.000Z" from a
// UTC server. A browser west of UTC renders that instant in its own zone and
// shows Sept 6. Every date-only field displayed one day early: meeting dates,
// workday dates, shift dates.
//
// Handing back the raw "YYYY-MM-DD" removes the instant entirely, so nothing
// downstream has a zone to convert. 1082 is DATE; timestamps are untouched,
// since those really are instants and should localise.
types.setTypeParser(types.builtins.DATE, (value) => value);

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
