const { pool } = require("../db/pool");
const {
  rateForOccupancy,
  hasOverride,
  baseAmountFor,
  sessionBaseFor,
  rebateFor,
  totalOwedFor,
  dueToDateFor,
} = require("../utils/houseFees");
const { roundMoney } = require("../utils/money");

// What a resident owes for a house session, and when.
//
// Moved out of houseController so the notifications feed can ask the same
// question for one brother. The dollar figures cannot be read straight from
// SQL: house_session_instalments stores percentages, so a resident's schedule
// only exists once their assignment, the session and the room rate have been
// combined.

const ASSIGNMENT_SELECT = `
  SELECT a.id, a.school_year, a.session_type, a.room_id, a.bed, a.brother_id,
         a.occupancy, a.start_date::text AS start_date, a.end_date::text AS end_date,
         a.base_amount, a.amount_override, a.override_note,
         a.member_discount, a.double_rebate, a.prepay_discount, a.notes,
         r.room_code, r.floor, r.sort_order,
         b.first_name, b.last_name, b.email, b.phone, b.status AS brother_status
  FROM house_assignments a
  JOIN house_rooms r ON r.id = a.room_id
  JOIN brothers b ON b.id = a.brother_id
`;

async function loadHouseContext(year, sessionType) {
  const [sessionRes, instRes, ratesRes] = await Promise.all([
    pool.query(
      `SELECT session_type, terms, start_date::text AS start_date, end_date::text AS end_date,
              member_rebate, prepay_discount_pct, prepay_deadline::text AS prepay_deadline,
              security_deposit_amount
       FROM house_sessions WHERE school_year = $1 AND session_type = $2`,
      [year, sessionType]
    ),
    pool.query(
      `SELECT seq, due_date::text AS due_date, weight_pct
       FROM house_session_instalments
       WHERE school_year = $1 AND session_type = $2 ORDER BY seq ASC`,
      [year, sessionType]
    ),
    pool.query(
      `SELECT room_id, capacity, rate_per_person
       FROM house_room_rates WHERE school_year = $1 AND session_type = $2`,
      [year, sessionType]
    ),
  ]);

  return {
    session: sessionRes.rows[0] ?? null,
    instalments: instRes.rows,
    ratesByRoom: new Map(ratesRes.rows.map((r) => [Number(r.room_id), r])),
  };
}

function decorateAssignment(row, ctx) {
  const rate = ctx.ratesByRoom.get(Number(row.room_id));
  const total_owed = totalOwedFor(row, ctx.session, rate);

  // The individual steps are returned so the UI can show its working rather
  // than re-deriving the arithmetic and drifting from the server.
  const session_base = sessionBaseFor(row, ctx.session, rate);
  const rebate_amount = rebateFor(row, ctx.session, rate);
  // An override is billed as entered, so neither discount applies — report them
  // as zero rather than letting the UI show a deduction that wasn't taken.
  const is_override = hasOverride(row);
  const prepay_pct =
    !is_override && row.prepay_discount ? Number(ctx.session?.prepay_discount_pct ?? 0) : 0;
  const prepay_amount = roundMoney((session_base - rebate_amount) * (prepay_pct / 100));

  return {
    ...row,
    capacity: rate?.capacity ?? 1,
    // resolved_rate is per term; session_base is what the whole session costs
    // before discounts.
    resolved_rate: rateForOccupancy(rate, row.occupancy),
    base_amount_effective: baseAmountFor(row, rate),
    session_base,
    terms: Number(ctx.session?.terms) || 1,
    rebate_per_term:
      !is_override && row.member_discount ? Number(ctx.session?.member_rebate ?? 0) : 0,
    rebate_beds:
      row.occupancy === "full_room" && row.double_rebate ? Math.max(rate?.capacity ?? 1, 1) : 1,
    rebate_amount,
    prepay_pct,
    prepay_amount,
    is_override,
    total_owed,
  };
}

/**
 * Per-brother totals for a session. A resident who moved mid-session holds two
 * assignments and owes the sum of both, with their payments counting once
 * against the combined total.
 */
async function houseBalancesFor({ year, sessionType, asOf, brotherIds = null }) {
  const ctx = await loadHouseContext(year, sessionType);
  if (!ctx.session) return { ctx, balances: new Map() };

  const values = [year, sessionType];
  let filter = "";
  if (brotherIds) {
    values.push(brotherIds);
    filter = `AND a.brother_id = ANY($${values.length}::int[])`;
  }

  const [assignmentsRes, paymentsRes] = await Promise.all([
    pool.query(
      `${ASSIGNMENT_SELECT}
       WHERE a.school_year = $1 AND a.session_type = $2 ${filter}
       ORDER BY r.sort_order ASC, r.room_code ASC, a.bed ASC`,
      values
    ),
    pool.query(
      `SELECT brother_id, COALESCE(SUM(amount), 0) AS total_paid
       FROM house_payments
       WHERE school_year = $1 AND session_type = $2
       GROUP BY brother_id`,
      [year, sessionType]
    ),
  ]);

  const paidByBrother = new Map(paymentsRes.rows.map((r) => [Number(r.brother_id), Number(r.total_paid)]));

  const byBrother = new Map();
  for (const row of assignmentsRes.rows) {
    const brotherId = Number(row.brother_id);
    const decorated = decorateAssignment(row, ctx);
    const entry = byBrother.get(brotherId) ?? {
      brother_id: brotherId,
      first_name: row.first_name,
      last_name: row.last_name,
      rooms: [],
      total_owed: 0,
    };
    entry.rooms.push(row.room_code);
    entry.total_owed = roundMoney(entry.total_owed + decorated.total_owed);
    byBrother.set(brotherId, entry);
  }

  // dueToDateFor compares against a Date; asOf is a calendar date, so it is
  // read at UTC midnight to keep the comparison off the local clock.
  const asOfDate = new Date(`${asOf}T23:59:59Z`);

  for (const entry of byBrother.values()) {
    const totalPaid = paidByBrother.get(entry.brother_id) ?? 0;
    const dueToDate = dueToDateFor(entry.total_owed, ctx.instalments, asOfDate);
    entry.year = year;
    entry.session_type = sessionType;
    entry.total_paid = totalPaid;
    entry.due_to_date = dueToDate;
    entry.balance_total = roundMoney(entry.total_owed - totalPaid);
    entry.balance_due_to_date = roundMoney(dueToDate - totalPaid);
    entry.is_behind = entry.balance_due_to_date > 0;
  }

  return { ctx, balances: byBrother };
}

module.exports = {
  ASSIGNMENT_SELECT,
  loadHouseContext,
  decorateAssignment,
  houseBalancesFor,
};
