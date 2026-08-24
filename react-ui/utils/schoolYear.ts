// "2026-09-01" is a calendar date, not an instant. `new Date(str)` reads a
// date-only string as UTC midnight, which in any zone behind UTC lands on the
// previous day locally — so a Sept 1 entry would file to the previous school
// year. Parse the components directly and keep it local. Mirrors the server's
// api/src/utils/schoolYear.js.
export function toLocalDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  const s = String(date);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  return new Date(s);
}

export function schoolYearStartForDate(date: string | Date): number {
  const d = toLocalDate(date);
  const y = d.getFullYear();
  const month = d.getMonth(); // 0=Jan ... 8=Sep
  return month >= 8 ? y : y - 1;
}

export function schoolYearLabel(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}
