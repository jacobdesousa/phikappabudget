const ROLE_PERMISSIONS = {
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
  ],
  // President: broad write access except financial disbursement by default
  alpha: [
    "brothers.read",
    "brothers.write",
    "dues.read",
    "revenue.read",
    "expenses.read",
    "meetings.read",
    "meetings.write",
    "chapterBonus.read",
    "workdays.read",
    "workdays.write",
    "shifts.setup.read",
    "shifts.cleanup.read",
    "shifts.party.read",
  ],
  // Finance officer (if used)
  beta: ["revenue.read", "revenue.write", "dues.read", "expenses.read"],
  // Secretary (Sigma): owns meeting minutes and votes
  sigma: ["meetings.read", "meetings.write"],
  // Psi: manages setup shifts
  psi: ["shifts.setup.read", "shifts.setup.write"],
  // Gamma: manages cleanup shifts
  gamma: ["shifts.cleanup.read", "shifts.cleanup.write"],
  // Zeta: also manages cleanup shifts
  zeta: ["shifts.cleanup.read", "shifts.cleanup.write"],
  // Theta: manages party shifts
  theta: ["shifts.party.read", "shifts.party.write"],
  // Alumni: view-only baseline (can be overridden per user)
  alumni: ["brothers.read", "meetings.read", "workdays.read", "chapterBonus.read"],
};

function normalizeRoleKey(value) {
  const k = String(value ?? "").trim().toLowerCase();
  return k || null;
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

module.exports = { ROLE_PERMISSIONS, computePermissions, normalizeRoleKey };


