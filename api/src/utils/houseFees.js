const { roundMoney } = require("./money");
const { toLocalDate } = require("./schoolYear");

// Defaults from "2026-27 Room Rates per Term PKS.pdf". Used to seed a school
// year when there is no prior year to copy from; everything is editable after.
//
// One rate per room per TERM (a 4-month period). For a double it is the
// per-person price, so a buy-out is capacity x rate_per_person — matching the
// schedule's $5,200 for a Double and $5,600 for a Heritage Double.
//
// Winter spans two terms and summer one, so a winter resident owes twice the
// figure below. The summer per-couple prices for single rooms are not modelled;
// they're effectively never used.
const DEFAULT_ROOM_RATES = {
  "1A": { capacity: 2, rate_per_person: 2600 },
  "2A": { capacity: 2, rate_per_person: 2800 },
  "2B": { capacity: 1, rate_per_person: 3600 },
  // 2C is physically a double, let as a private single at the Co-op's discretion.
  "2C": { capacity: 1, rate_per_person: 3200 },
  "2D": { capacity: 1, rate_per_person: 3600 },
  "2E": { capacity: 2, rate_per_person: 2800 },
  "2F": { capacity: 1, rate_per_person: 3400 },
  "2G": { capacity: 1, rate_per_person: 3000 },
  "3A": { capacity: 1, rate_per_person: 3400 },
  "3B": { capacity: 1, rate_per_person: 3400 },
  "3C": { capacity: 2, rate_per_person: 2600 },
  "3D": { capacity: 2, rate_per_person: 2600 },
  "3E": { capacity: 1, rate_per_person: 3400 },
  "3F": { capacity: 1, rate_per_person: 3000 },
  "3G": { capacity: 1, rate_per_person: 3000 },
};

const DEFAULT_PAYEES = [
  { payee: "TSPHC", pct: 89, is_internal: false, sort_order: 10 },
  { payee: "PKSAB", pct: 11, is_internal: true, sort_order: 20 },
];

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Which session a date falls in: winter runs Sep 1 – Apr 30, summer May 1 – Aug
// 31. Mirrors the ranges defaultSession() seeds.
function sessionTypeForDate(date) {
  // toLocalDate, not `new Date(str)`: a date-only string parsed as UTC lands on
  // the previous day locally, which flips May 1 and Sep 1 into the wrong session.
  const month = toLocalDate(date).getMonth(); // 0=Jan … 11=Dec
  return month >= 4 && month <= 7 ? "summer" : "winter";
}

// Winter precedes summer inside a school year, which no alphabetical sort
// gives — summer is the tail of the year that began the previous September.
function sessionOrdinal(sessionType) {
  return sessionType === "winter" ? 0 : 1;
}

// "1st", "2nd", "3rd", "4th" — derived from seq, never stored.
function instalmentLabel(seq) {
  const n = Number(seq);
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

// Display name for a session — derived, never stored.
// `year` is the September start year: 2026 => "Winter 2026-27" / "Summer 2027".
function sessionLabel(year, sessionType) {
  return sessionType === "winter"
    ? `Winter ${year}-${String(year + 1).slice(2)}`
    : `Summer ${year + 1}`;
}

// `year` is the September start year: 2026 => 2026-27.
function defaultSession(year, sessionType) {
  if (sessionType === "winter") {
    return {
      session_type: "winter",
      terms: 2,
      start_date: iso(year, 9, 1),
      end_date: iso(year + 1, 4, 30),
      member_rebate: 400,
      prepay_discount_pct: 5,
      prepay_deadline: iso(year, 9, 15),
      security_deposit_amount: 500,
      instalments: [
        { seq: 1, due_date: iso(year, 7, 15), weight_pct: 25 },
        { seq: 2, due_date: iso(year, 10, 15), weight_pct: 25 },
        { seq: 3, due_date: iso(year, 12, 15), weight_pct: 25 },
        { seq: 4, due_date: iso(year + 1, 2, 15), weight_pct: 25 },
      ],
    };
  }
  return {
    session_type: "summer",
    terms: 1,
    start_date: iso(year + 1, 5, 1),
    end_date: iso(year + 1, 8, 31),
    member_rebate: 0,
    prepay_discount_pct: 0,
    prepay_deadline: null,
    security_deposit_amount: 500,
    instalments: [
      { seq: 1, due_date: iso(year + 1, 3, 15), weight_pct: 50 },
      { seq: 2, due_date: iso(year + 1, 6, 15), weight_pct: 50 },
    ],
  };
}

// One rate per room per term. A buy-out takes the whole room, so it costs the
// per-person price times the room's capacity.
function rateForOccupancy(rate, occupancy) {
  if (!rate || rate.rate_per_person === null || rate.rate_per_person === undefined) return null;
  const perPerson = Number(rate.rate_per_person);
  if (occupancy === "full_room") return roundMoney(perPerson * Math.max(Number(rate.capacity) || 1, 1));
  return perPerson;
}

// An override is the final word on what a resident owes — the figure entered is
// exactly the figure billed, with no rebate or pre-payment discount applied on
// top. It exists for cases the rate card can't express (a half-session stay, a
// negotiated rate), where re-deriving from terms and discounts would fight the
// number the treasurer meant.
function hasOverride(assignment) {
  return assignment.amount_override !== null && assignment.amount_override !== undefined;
}

// The per-term rate for this assignment. Overrides are handled at session level
// in sessionBaseFor, since a mid-session adjustment is a session figure.
function baseAmountFor(assignment, rate) {
  if (assignment.base_amount !== null && assignment.base_amount !== undefined) {
    return Number(assignment.base_amount);
  }
  const resolved = rateForOccupancy(rate, assignment.occupancy);
  return resolved === null || resolved === undefined ? 0 : Number(resolved);
}

function termsIn(session) {
  return Math.max(Number(session?.terms) || 1, 1);
}

// The rebate is configured per term and granted per term, so winter's $400
// becomes $800. A buy-out pays for every bed, so the Co-op may grant the rebate
// on each of them — a per-assignment call, not a standing policy.
function rebateFor(assignment, session, rate) {
  // An overridden amount already accounts for the rebate.
  if (hasOverride(assignment)) return 0;
  if (!assignment.member_discount) return 0;
  const perTerm = Number(session?.member_rebate ?? 0);
  const beds =
    assignment.occupancy === "full_room" && assignment.double_rebate
      ? Math.max(Number(rate?.capacity) || 1, 1)
      : 1;
  return roundMoney(perTerm * beds * termsIn(session));
}

// What the room costs for the whole session before discounts: the per-term rate
// times the session's term count. A manual override replaces that outright — it
// is entered as a session figure, not a per-term one.
function sessionBaseFor(assignment, session, rate) {
  if (hasOverride(assignment)) return Number(assignment.amount_override);
  return roundMoney(baseAmountFor(assignment, rate) * termsIn(session));
}

// session base − member rebate, then the pre-payment discount on the remainder.
// An override short-circuits all of it: what was entered is what is owed.
function totalOwedFor(assignment, session, rate) {
  if (hasOverride(assignment)) return roundMoney(Number(assignment.amount_override));
  const base = sessionBaseFor(assignment, session, rate);
  const rebate = rebateFor(assignment, session, rate);
  const afterRebate = base - rebate;
  const pct = assignment.prepay_discount ? Number(session?.prepay_discount_pct ?? 0) : 0;
  return roundMoney(pct ? afterRebate * (1 - pct / 100) : afterRebate);
}

function dueToDateFor(totalOwed, instalments, asOf = new Date()) {
  return roundMoney(
    instalments.reduce((sum, inst) => {
      if (!inst.due_date) return sum;
      if (new Date(inst.due_date) > asOf) return sum;
      return sum + roundMoney(totalOwed * (Number(inst.weight_pct) / 100));
    }, 0)
  );
}

// Two date ranges overlap when each starts before the other ends. A null bound
// is treated as open-ended so an assignment without dates blocks the bed.
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const as = aStart ? new Date(aStart) : null;
  const ae = aEnd ? new Date(aEnd) : null;
  const bs = bStart ? new Date(bStart) : null;
  const be = bEnd ? new Date(bEnd) : null;
  if (ae && bs && ae < bs) return false;
  if (be && as && be < as) return false;
  return true;
}

module.exports = {
  DEFAULT_ROOM_RATES,
  DEFAULT_PAYEES,
  instalmentLabel,
  sessionLabel,
  sessionTypeForDate,
  sessionOrdinal,
  defaultSession,
  rateForOccupancy,
  hasOverride,
  baseAmountFor,
  sessionBaseFor,
  termsIn,
  rebateFor,
  totalOwedFor,
  dueToDateFor,
  rangesOverlap,
};
