// Chore schedule.
//
// The schedule is a stored lookup table, not a computed rotation: one duty per
// bedroom per half-month, exactly as the printed "Chore Schedule Bannerman
// House" sheet lays it out. It changes about once a year, so it is edited as a
// grid rather than derived from rules.
//
// This module only does the calendar arithmetic around that grid: which
// half-month a date falls in, and how a (month, half) maps to a column.

const { toLocalDate, schoolYearStartForDate } = require("./schoolYear");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Columns run September → August, two per month, matching the printed sheet.
const PERIODS_PER_YEAR = 24;

function pad(n) {
  return String(n).padStart(2, "0");
}

function ymd(year, monthIndex, day) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// 0 for September … 11 for August.
function monthOffsetFromSeptember(monthIndex) {
  return (monthIndex - 8 + 12) % 12;
}

// The grid column for a month and half: Sept 1-15 is 0, Sept 16-30 is 1, etc.
function periodIndex(monthIndex, half) {
  return monthOffsetFromSeptember(monthIndex) * 2 + half;
}

function monthIndexForPeriod(index) {
  return (Math.floor(index / 2) + 8) % 12;
}

function periodIndexLabel(index) {
  const monthIndex = monthIndexForPeriod(index);
  return `${MONTH_NAMES[monthIndex]} ${index % 2 === 0 ? "1st half" : "2nd half"}`;
}

// The two periods of one month. `half` is 0 for the first, 1 for the second.
function periodsForMonth(year, monthIndex, splitDay) {
  const last = daysInMonth(year, monthIndex);
  const split = Math.min(Math.max(Number(splitDay) || 16, 2), last);
  return [0, 1].map((half) => ({
    half,
    year,
    month: monthIndex,
    period_index: periodIndex(monthIndex, half),
    start_date: half === 0 ? ymd(year, monthIndex, 1) : ymd(year, monthIndex, split),
    end_date: half === 0 ? ymd(year, monthIndex, split - 1) : ymd(year, monthIndex, last),
    label: half === 0 ? `${MONTH_NAMES[monthIndex]} 1–${split - 1}` : `${MONTH_NAMES[monthIndex]} ${split}–${last}`,
    month_label: `${MONTH_NAMES[monthIndex]} ${year}`,
  }));
}

function addMonths(year, monthIndex, delta) {
  const total = year * 12 + monthIndex + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// The period containing a date, plus the one after it.
function periodForDateWithNext(date, splitDay) {
  const d = toLocalDate(date);
  const [first, second] = periodsForMonth(d.getFullYear(), d.getMonth(), splitDay);
  const current = d.getDate() < toLocalDate(second.start_date).getDate() ? first : second;
  if (current.half === 0) return { current, next: second };
  const nxt = addMonths(d.getFullYear(), d.getMonth(), 1);
  return { current, next: periodsForMonth(nxt.year, nxt.month, splitDay)[0] };
}

// Sessions run Sep-Apr (winter) and May-Aug (summer); a period belongs to the
// one containing its start date, which is how the occupant is looked up.
function sessionForMonth(monthIndex) {
  return monthIndex >= 8 || monthIndex <= 3 ? "winter" : "summer";
}

function sessionKeyForPeriod(period) {
  return {
    school_year: schoolYearStartForDate(period.start_date),
    session_type: sessionForMonth(period.month),
  };
}

// Inclusive month range covering `from`..`to`.
function monthsBetween(from, to) {
  const start = toLocalDate(from);
  const end = toLocalDate(to);
  const months = [];
  let cur = { year: start.getFullYear(), month: start.getMonth() };
  const lastKey = end.getFullYear() * 12 + end.getMonth();
  // Guard against a reversed or absurd range rather than looping forever.
  for (let i = 0; i < 240; i++) {
    if (cur.year * 12 + cur.month > lastKey) break;
    months.push(cur);
    cur = addMonths(cur.year, cur.month, 1);
  }
  return months;
}

module.exports = {
  MONTH_NAMES,
  PERIODS_PER_YEAR,
  periodIndex,
  periodIndexLabel,
  monthIndexForPeriod,
  monthOffsetFromSeptember,
  periodsForMonth,
  periodForDateWithNext,
  addMonths,
  sessionForMonth,
  sessionKeyForPeriod,
  monthsBetween,
};
