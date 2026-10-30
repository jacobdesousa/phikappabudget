// "2026-09-01" is a calendar date, not an instant. `new Date(str)` reads a
// date-only string as UTC midnight, which in any zone behind UTC lands on the
// previous day locally — so a Sept 1 payment was filed to the previous school
// year. Parse the components directly and keep it local.
function toLocalDate(date) {
  if (date instanceof Date) return date;
  const s = String(date);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  return new Date(s);
}

function schoolYearStartForDate(date) {
  const d = toLocalDate(date);
  const y = d.getFullYear();
  const month = d.getMonth(); // 0=Jan ... 8=Sep
  // School year starts in September
  return month >= 8 ? y : y - 1;
}

function currentSchoolYearStart() {
  return schoolYearStartForDate(new Date());
}

// Today as the chapter sees it. The server runs UTC, where anything after 8pm
// Toronto is already tomorrow — a reminder dated "today" has to mean today
// here, not in Greenwich.
function todayInToronto() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Calendar-date arithmetic on "YYYY-MM-DD" strings, with no timezone anywhere
// in the path: Date.UTC in, UTC parts out.
function addDays(ymd, days) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// Whole days from `from` to `to`; negative when `to` is in the past.
function daysBetween(from, to) {
  const parse = (v) => {
    const [y, m, d] = String(v).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86400000);
}

module.exports = {
  toLocalDate,
  schoolYearStartForDate,
  currentSchoolYearStart,
  todayInToronto,
  addDays,
  daysBetween,
};
