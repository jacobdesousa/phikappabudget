export function formatNorthAmericanPhone(value: string): string {
  const digitsRaw = (value ?? "").replace(/\D/g, "");

  // Allow a leading country code "1"
  const digits = digitsRaw.length === 11 && digitsRaw.startsWith("1")
    ? digitsRaw.slice(1)
    : digitsRaw.slice(0, 10);

  const len = digits.length;
  if (len === 0) return "";
  if (len <= 3) return `(${digits}`;
  if (len <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}


