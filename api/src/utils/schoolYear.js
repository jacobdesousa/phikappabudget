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

module.exports = { toLocalDate, schoolYearStartForDate, currentSchoolYearStart };
