import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js";

// Numbers typed without a country code are assumed local to the chapter.
// International residents enter their number with the "+" prefix.
export const DEFAULT_COUNTRY = "CA";

// Phones are stored in E.164 ("+353831234567"); this is the human-facing shape.
// Local numbers read as "(416) 555-1234", everything else as
// "+353 83 123 4567" so the country is visible.
export function formatPhoneForDisplay(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  const parsed = parsePhoneNumberFromString(raw, DEFAULT_COUNTRY);
  if (!parsed || !parsed.isValid()) return raw;

  return parsed.country === DEFAULT_COUNTRY
    ? parsed.formatNational()
    : parsed.formatInternational();
}

// Progressive formatting while the field is being typed. Unlike the display
// formatter this must never reorder or drop characters — the caret would jump.
export function formatPhoneInput(value: string): string {
  const raw = value ?? "";
  if (!raw) return "";

  // Once a "+" is present the country comes from the number itself; without one
  // we format against the default country.
  const typed = new AsYouType(raw.trim().startsWith("+") ? undefined : DEFAULT_COUNTRY).input(raw);

  // AsYouType returns "" for input it can't lay out yet (e.g. a lone "+");
  // showing the raw keystrokes beats blanking the field.
  return typed || raw;
}

// What gets sent to the API. The server normalises too, so this is only to keep
// the value the user sees and the value stored in step.
export function toE164(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const parsed = parsePhoneNumberFromString(raw, DEFAULT_COUNTRY);
  return parsed && parsed.isValid() ? parsed.number : raw;
}
