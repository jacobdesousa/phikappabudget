// Value for an <input type="date">, from whatever the server or the user gave.
//
// A native date input emits "" for an incomplete date — the moment you type a
// 0 into the month, the whole value goes empty and comes back through state.
// Formatting that with `new Date(v).toISOString()` throws RangeError during
// render, which unmounts the page rather than showing an empty field. Anything
// unparseable therefore has to become "", the input's own empty value.
//
// Dates are read in UTC on purpose. A DATE column arrives as midnight UTC, and
// reading it locally would move it to the previous day anywhere west of
// Greenwich.
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  // Already a calendar date — hand back the day as written rather than routing
  // it through an instant, which would shift it in one direction or the other
  // depending on the viewer's offset.
  const ymd = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  if (ymd) return ymd[1];
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A calendar date rendered as text, with no timezone conversion anywhere in the
// path. The API returns DATE columns as "YYYY-MM-DD"; reading one with
// `new Date(v)` would treat it as UTC midnight and display the previous day in
// any zone behind UTC, which is exactly the off-by-one this avoids.
//
// Timestamps — created_at, submitted_at — are genuine instants and should keep
// using `new Date`, so that they localise.
export function formatDateOnly(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
  locale?: string
): string {
  if (!value) return "—";
  const d = toLocalDateOnly(value);
  if (!d) return "—";
  return d.toLocaleDateString(locale, options);
}

// "2026-09-07" (or an ISO string starting with one) as a Date at *local*
// midnight, so every getMonth/getDate reads the calendar date that was stored.
// Mirrors toLocalDate in utils/schoolYear.ts and the server's own copy.
export function toLocalDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
