const { pool } = require("../db/pool");
const { currentSchoolYearStart } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");
const { yearSessionQuerySchema } = require("../validation/house");
const {
  rateForOccupancy,
  hasOverride,
  baseAmountFor,
  sessionBaseFor,
  rebateFor,
  termsIn,
} = require("../utils/houseFees");

// Winter runs Fall then Winter term; summer is a single term.
function termLabels(sessionType, terms) {
  if (sessionType === "winter" && terms === 2) return ["Fall Session Fees", "Winter Session Fees"];
  if (terms === 1) return [sessionType === "summer" ? "Summer Session Fees" : "Session Fees"];
  return Array.from({ length: terms }, (_v, i) => `Term ${i + 1} Fees`);
}

function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

// The fee table from the agreement's invoice page. Deliberately independent of
// whether the resident has actually claimed the pre-payment discount: the form
// presents both payment paths and they choose when they sign.
function buildCharges(assignment, session, rate, instalments) {
  const terms = termsIn(session);
  const isOverride = hasOverride(assignment);
  const termRate = roundMoney(baseAmountFor(assignment, rate));
  const gross = roundMoney(sessionBaseFor(assignment, session, rate));
  const rebate = roundMoney(rebateFor({ ...assignment, prepay_discount: false }, session, rate));
  const net = roundMoney(gross - rebate);

  // An overridden fee is billed exactly as entered, so the agreement must not
  // offer a pre-payment discount on top of it.
  const prepayPct = isOverride ? 0 : Number(session?.prepay_discount_pct ?? 0);
  const prepayDiscount = roundMoney(net * (prepayPct / 100));
  const netNet = roundMoney(net - prepayDiscount);

  // Instalments divide the net fees; pre-paying replaces all but the first.
  const schedule = instalments.map((i) => ({
    seq: i.seq,
    label: `${ordinal(i.seq)} Instalment`,
    due_date: i.due_date,
    amount: roundMoney(net * (Number(i.weight_pct) / 100)),
  }));
  const firstInstalment = schedule[0]?.amount ?? 0;

  return {
    term_rate: termRate,
    terms,
    // Unused when is_override — the agreement prints a single adjusted line.
    term_rows: termLabels(session.session_type, terms).map((label) => ({
      label,
      amount: termRate,
    })),
    total_fees: gross,
    rebate_per_term: isOverride ? 0 : Number(session?.member_rebate ?? 0),
    rebate_amount: rebate,
    net_fees: net,
    prepay_pct: prepayPct,
    prepay_deadline: session?.prepay_deadline ?? null,
    prepay_discount: prepayDiscount,
    net_net_fees: netNet,
    instalments: schedule,
    // Pay the first instalment, then settle the rest by the pre-payment date.
    prepayment_balance: roundMoney(netNet - firstInstalment),
    security_deposit: Number(session?.security_deposit_amount ?? 0),
    is_override: isOverride,
    override_note: assignment.override_note ?? null,
  };
}

async function getHouseAgreement(req, res) {
  const q = yearSessionQuerySchema.parse(req.query);
  const year = q.year ?? currentSchoolYearStart();
  const sessionType = q.session ?? "winter";
  const brotherId = req.query.brother_id ? Number(req.query.brother_id) : null;

  const [sessionRes, instRes, ratesRes, duesRes] = await Promise.all([
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
    // Social dues are a separate stream, but the form lists them as a charge.
    pool.query(
      `SELECT category, total_amount FROM dues_plan_categories WHERE year = $1`,
      [year]
    ),
  ]);

  const session = sessionRes.rows[0];
  if (!session) {
    return res
      .status(404)
      .json({ error: { message: `No ${sessionType} session configured for ${year}` } });
  }

  const ratesByRoom = new Map(ratesRes.rows.map((r) => [Number(r.room_id), r]));

  const params = [year, sessionType];
  if (brotherId) params.push(brotherId);
  const { rows } = await pool.query(
    `SELECT a.id, a.room_id, a.bed, a.brother_id, a.occupancy,
            a.start_date::text AS start_date, a.end_date::text AS end_date,
            a.base_amount, a.amount_override, a.override_note,
            a.member_discount, a.double_rebate, a.prepay_discount,
            r.room_code, r.sort_order,
            b.first_name, b.last_name, b.email, b.phone, b.pledge_class, b.status AS brother_status
     FROM house_assignments a
     JOIN house_rooms r ON r.id = a.room_id
     JOIN brothers b ON b.id = a.brother_id
     WHERE a.school_year = $1 AND a.session_type = $2
       ${brotherId ? "AND a.brother_id = $3" : ""}
     ORDER BY r.sort_order ASC, r.room_code ASC, a.bed ASC`,
    params
  );

  const residents = rows.map((row) => {
    const rate = ratesByRoom.get(Number(row.room_id));
    return {
      assignment_id: row.id,
      brother_id: row.brother_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      pledge_class: row.pledge_class,
      brother_status: row.brother_status,
      room_code: row.room_code,
      bed: row.bed,
      capacity: rate?.capacity ?? 1,
      occupancy: row.occupancy,
      start_date: row.start_date,
      end_date: row.end_date,
      charges: buildCharges(row, session, rate, instRes.rows),
    };
  });

  const duesByCategory = Object.fromEntries(
    duesRes.rows.map((r) => [r.category, roundMoney(Number(r.total_amount))])
  );

  return res.status(200).json({
    year,
    session_type: sessionType,
    session,
    dues: duesByCategory,
    residents,
  });
}

module.exports = { getHouseAgreement };
