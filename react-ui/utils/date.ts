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
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
