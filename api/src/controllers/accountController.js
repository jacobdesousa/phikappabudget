const { pool } = require("../db/pool");
const { loadAuthContext } = require("../middleware/auth");
const { currentSchoolYearStart, todayInToronto } = require("../utils/schoolYear");
const { sessionTypeForDate, sessionLabel } = require("../utils/houseFees");
const { duesCategoryForBrother } = require("../utils/pledgeClass");
const { isActiveInYear } = require("../utils/membership");
const {
  loadDuesPlanContext,
  loadDuesPaidByBrother,
  duesBalanceFor,
  instalmentsForCategory,
} = require("../services/duesBalance");
const { houseBalancesFor } = require("../services/houseBalance");
const { loadOutstandingMakeups } = require("../services/makeupQueries");
const { computeStandings } = require("../services/roomDrawStandings");
const { buildFeed } = require("../services/notificationFeed");

// A brother's own account: what they owe, what they've paid, what they owe the
// chapter in time, and their standing.
//
// Everything here is personal, so the only gate is being signed in. The
// chapter-wide pages this draws on each sit behind an officer permission —
// /house-instalments needs house.read, which an ordinary member does not have —
// which is why notifications and reminder emails link here instead of there.

/**
 * One brother's dues position plus the schedule behind it.
 *
 * Null for anyone who was not an active member that year. Dues are owed by the
 * active chapter, and the plan total applies to a category derived from pledge
 * class — which every brother has, alumni included. Without this check an
 * alumnus opens their account and is told they owe a year of dues they were
 * never billed for.
 */
async function duesSection(brother, year, asOf) {
  if (!isActiveInYear(brother, year)) return null;

  const ctx = await loadDuesPlanContext(year, asOf);
  if (!ctx) return null;

  const paid = await loadDuesPaidByBrother(year, [brother.id]);
  const balance = duesBalanceFor(brother, ctx, paid.get(Number(brother.id)));
  const category = duesCategoryForBrother(brother.pledge_class, year);

  const { rows: payments } = await pool.query(
    `SELECT id, paid_at::text AS paid_at, amount, memo
     FROM dues_payments
     WHERE brother_id = $1 AND dues_year = $2
     ORDER BY paid_at DESC, id DESC`,
    [brother.id, year]
  );

  return {
    year,
    category,
    total_owed: balance.total_owed,
    total_paid: balance.total_paid,
    due_to_date: balance.due_to_date,
    balance_total: balance.balance_total,
    balance_due_to_date: balance.balance_due_to_date,
    is_behind: balance.is_behind,
    instalments: instalmentsForCategory(ctx, category).map((i) => ({
      label: i.label,
      due_date: i.due_date,
      amount: Number(i.amount),
      // Payments are one pool with no per-instalment allocation, so "covered"
      // can only mean cumulative — the UI must not call this one paid.
      covered: balance.total_paid >= cumulativeThrough(ctx, category, i.due_date),
    })),
    payments,
  };
}

function cumulativeThrough(ctx, category, dueDate) {
  return instalmentsForCategory(ctx, category)
    .filter((i) => i.due_date <= dueDate)
    .reduce((sum, i) => sum + Number(i.amount), 0);
}

/** Residence fees, if this brother is living in. */
async function residenceSection(brotherId, year, asOf) {
  const sessionType = sessionTypeForDate(asOf);
  const { ctx, balances } = await houseBalancesFor({
    year,
    sessionType,
    asOf,
    brotherIds: [brotherId],
  });
  const entry = balances.get(Number(brotherId));
  if (!entry) return null;

  const { rows: payments } = await pool.query(
    `SELECT id, paid_at::text AS paid_at, amount, memo
     FROM house_payments
     WHERE brother_id = $1 AND school_year = $2 AND session_type = $3
     ORDER BY paid_at DESC, id DESC`,
    [brotherId, year, sessionType]
  );

  const { rows: deposit } = await pool.query(
    `SELECT status, amount, received_at::text AS received_at
     FROM house_deposits WHERE brother_id = $1`,
    [brotherId]
  );

  let running = 0;
  const instalments = ctx.instalments.map((i) => {
    const amount = entry.total_owed * (Number(i.weight_pct) / 100);
    running += amount;
    return {
      seq: i.seq,
      due_date: i.due_date,
      amount: Math.round(amount * 100) / 100,
      covered: entry.total_paid >= running - 0.005,
    };
  });

  return {
    year,
    session_type: sessionType,
    session_label: sessionLabel(year, sessionType),
    rooms: entry.rooms,
    total_owed: entry.total_owed,
    total_paid: entry.total_paid,
    due_to_date: entry.due_to_date,
    balance_total: entry.balance_total,
    balance_due_to_date: entry.balance_due_to_date,
    is_behind: entry.is_behind,
    instalments,
    payments,
    deposit: deposit[0] ?? null,
  };
}

async function accountSummary(req, res) {
  const ctx = await loadAuthContext(req);
  if (!ctx) return res.status(401).json({ error: { message: "Unauthorized" } });
  if (!ctx.brother_id) {
    return res.json({ brother: null, message: "This account has no brother record." });
  }

  const brotherId = ctx.brother_id;
  const asOf = todayInToronto();
  const year = req.query.year ? Number(req.query.year) : currentSchoolYearStart();

  const { rows: brotherRows } = await pool.query(
    `SELECT id, first_name, last_name, email, email_secondary, phone, pledge_class,
            graduation, status, alumni_date::text AS alumni_date,
            address_line1, address_line2, city, province, postal_code, country
     FROM brothers WHERE id = $1`,
    [brotherId]
  );
  const brother = brotherRows[0];
  if (!brother) return res.status(404).json({ error: { message: "Brother not found" } });

  // Each section is independent: a chapter with no dues plan configured should
  // still show someone their shifts and their room, not an error page.
  const [offices, dues, residence, makeups, standings, upcoming] = await Promise.all([
    pool
      .query(
        `SELECT bo.office_key, o.display_name,
                bo.start_date::text AS start_date, bo.end_date::text AS end_date,
                (bo.start_date <= CURRENT_DATE AND (bo.end_date IS NULL OR bo.end_date >= CURRENT_DATE)) AS is_current
         FROM brother_offices bo
         LEFT JOIN offices o ON o.office_key = bo.office_key
         WHERE bo.brother_id = $1
         ORDER BY bo.start_date DESC`,
        [brotherId]
      )
      .then((r) => r.rows)
      .catch(() => []),
    duesSection(brother, year, asOf).catch(() => null),
    residenceSection(brotherId, year, asOf).catch(() => null),
    loadOutstandingMakeups({ asOf, brotherIds: [brotherId] }).catch(() => null),
    computeStandings({ brotherIds: [brotherId] })
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    buildFeed(brotherId, { asOf, kinds: ["shift", "workday", "chore_duty"] }).catch(() => []),
  ]);

  const makeupCount = makeups
    ? makeups.workday.length + makeups.shift.length + makeups.party.length
    : 0;

  return res.json({
    as_of: asOf,
    year,
    brother,
    offices,
    dues,
    residence,
    makeups: makeups ? { ...makeups, total: makeupCount } : null,
    room_draw: standings,
    upcoming,
  });
}

module.exports = { accountSummary };
