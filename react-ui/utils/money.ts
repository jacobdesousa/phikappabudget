export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function formatMoney(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  const rounded = roundMoney(Number.isFinite(num) ? num : 0);
  return rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function normalizeMoneyInput(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return "0.00";
  return roundMoney(n).toFixed(2);
}



// Keystroke-level filter for money fields. `type="number"` looks like it
// rejects letters but still accepts "e", "E", "+" and "-" for exponent
// notation, so "1e5" and a bare "e" both get through. Filtering the value
// itself is the only way to keep a money field to digits.
//
// Deliberately permissive mid-typing: an empty string and a trailing "." are
// both valid states on the way to a number. normalizeMoneyInput settles it on
// blur.
export function sanitizeMoneyInput(raw: string): string {
  const cleaned = (raw ?? "").replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  // Keep only the first decimal point, and at most two digits after it.
  const whole = cleaned.slice(0, firstDot);
  const fraction = cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  return `${whole}.${fraction}`;
}
