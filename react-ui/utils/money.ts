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


