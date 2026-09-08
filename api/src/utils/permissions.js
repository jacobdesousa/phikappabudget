const ROLE_PERMISSIONS = {
  // Platform admin: all permissions, not tied to any office
  admin: [
    "admin.sessions",
    "admin.users",
    // Opening the app as another user, to check what their roles actually see.
    // Deliberately not given to tau: admin.users is broad enough already, and
    // wearing someone else's account is a separate decision.
    "admin.viewAs",
    "brothers.read",
    "brothers.write",
    "dues.read",
    "dues.write",
    "dues.config",
    "revenue.read",
    "revenue.write",
    "revenue.config",
    "expenses.read",
    "expenses.write",
    "expenses.review",
    "expenses.disburse",
    "budget.read",
    "budget.write",
    "meetings.read",
    "meetings.write",
    "chapterBonus.read",
    "chapterBonus.write",
    "chapterBonus.config",
    "workdays.read",
    "workdays.write",
    "shifts.setup.read",
    "shifts.setup.write",
    "shifts.cleanup.read",
    "shifts.cleanup.write",
    "shifts.party.read",
    "shifts.party.write",
    "roomDraw.read",
    "roomDraw.write",
    "house.read",
    "house.write",
    "house.config",
    "chores.read",
    "chores.write",
    "chores.config",
    "donations.read",
    "donations.write",
    "donations.config",
  ],
  // Treasurer / finance chair: full access
  tau: [
    "admin.users",
    "brothers.read",
    "brothers.write",
    "dues.read",
    "dues.write",
    "dues.config",
    "revenue.read",
    "revenue.write",
    "revenue.config",
    "expenses.read",
    "expenses.write",
    "expenses.review",
    "expenses.disburse",
    "budget.read",
    "budget.write",
    "meetings.read",
    "meetings.write",
    "chapterBonus.read",
    "chapterBonus.write",
    "chapterBonus.config",
    "workdays.read",
    "workdays.write",
    "shifts.setup.read",
    "shifts.cleanup.read",
    "shifts.party.read",
    "roomDraw.read",
    "roomDraw.write",
    "house.read",
    "house.write",
    "house.config",
    "chores.read",
    "chores.write",
    "chores.config",
    // Alumni giving is the treasurer's ledger.
    "donations.read",
    "donations.write",
    "donations.config",
  ],
  // President: broad write access except financial disbursement by default
  alpha: [
    "brothers.read",
    "brothers.write",
    "dues.read",
    "revenue.read",
    "expenses.read",
    "budget.read",
    "meetings.read",
    "meetings.write",
    "chapterBonus.read",
    "workdays.read",
    "workdays.write",
    "shifts.setup.read",
    "shifts.cleanup.read",
    "shifts.party.read",
    "roomDraw.read",
    "roomDraw.write",
    "house.read",
    "house.write",
    "chores.read",
    "chores.write",
    "chores.config",
    "donations.read",
  ],
  // Finance officer (if used)
  beta: ["revenue.read", "revenue.write", "dues.read", "expenses.read", "budget.read", "roomDraw.read", "roomDraw.write", "house.read", "chores.read"],
  // Secretary (Sigma): owns meeting minutes and votes
  sigma: ["meetings.read", "meetings.write"],
  // Psi: manages setup shifts
  psi: ["shifts.setup.read", "shifts.setup.write"],
  // Gamma (House Manager): manages cleanup shifts and the house chore rotation
  gamma: ["shifts.cleanup.read", "shifts.cleanup.write", "chores.read", "chores.write", "chores.config"],
  // Zeta: also manages cleanup shifts
  zeta: ["shifts.cleanup.read", "shifts.cleanup.write"],
  // Theta: manages party shifts
  theta: ["shifts.party.read", "shifts.party.write"],
  // Alumni board: an office like any other, granted through brother_offices.
  // Being an alumnus is not itself a role — plenty of alumni have logins and
  // need nothing beyond the member baseline.
  //
  // Residents, instalments and the house account are all gated by the single
  // house.read/house.write pair, so there is no finer split to make there.
  // The board owns the setup for what it runs, hence the .config keys.
  alumni_board: [
    "brothers.read",
    "brothers.write",
    "workdays.read",
    "workdays.write",
    "chapterBonus.read",
    "chapterBonus.write",
    "chapterBonus.config",
    "roomDraw.read",
    "house.read",
    "house.write",
    "house.config",
    "chores.read",
    "chores.write",
    "chores.config",
    "donations.read",
    "donations.write",
    "donations.config",
  ],
  // Member: default read-only granted to every authenticated user
  member: [
    "brothers.read",
    "dues.read",
    "revenue.read",
    "expenses.read",
    "budget.read",
    "meetings.read",
    "workdays.read",
    "chapterBonus.read",
    "shifts.setup.read",
    "shifts.cleanup.read",
    "shifts.party.read",
    "roomDraw.read",
    "chores.read",
  ],
};

function normalizeRoleKey(value) {
  const k = String(value ?? "").trim().toLowerCase();
  return k || null;
}

// What each role actually grants, according to the database.
//
// The role_permissions table is the source of truth once configured; the code
// defaults above are only a fallback for a role with no rows. Callers must
// resolve through this rather than letting computePermissions fall back to the
// defaults, or they report what the code says instead of what the chapter set
// — which is how the users page came to show tau with 36 permissions while the
// role permissions page showed 11.
//
// `db` is the pg pool, passed in so this file stays free of a database import.
async function resolveRolePermissions(db, roles) {
  const keys = Array.from(new Set(roles.map((r) => String(r).toLowerCase())));
  const effective = {};
  let fromDb = new Map();
  if (keys.length > 0) {
    try {
      const { rows } = await db.query(
        `SELECT role_key, permission_key FROM role_permissions WHERE role_key = ANY($1::text[])`,
        [keys]
      );
      for (const r of rows ?? []) {
        const k = String(r.role_key ?? "").toLowerCase();
        if (!fromDb.has(k)) fromDb.set(k, []);
        fromDb.get(k).push(r.permission_key);
      }
    } catch {
      // Table not present yet on a first boot; fall back to the code defaults.
      fromDb = new Map();
    }
  }
  for (const key of keys) {
    const stored = fromDb.get(key);
    effective[key] = stored && stored.length > 0 ? stored : ROLE_PERMISSIONS[key] ?? [];
  }
  return effective;
}

function computePermissions({ roles = [], overrides = [], rolePermissions = ROLE_PERMISSIONS }) {
  const set = new Set();
  for (const r of roles) {
    for (const p of rolePermissions[String(r).toLowerCase()] ?? []) set.add(p);
  }
  // overrides: [{ permission_key, effect }]
  for (const o of overrides ?? []) {
    const key = o.permission_key;
    if (!key) continue;
    if (o.effect === "deny") set.delete(key);
    if (o.effect === "allow") set.add(key);
  }
  return Array.from(set);
}

module.exports = { ROLE_PERMISSIONS, computePermissions, normalizeRoleKey, resolveRolePermissions };


