const { parsePhoneNumberFromString } = require("libphonenumber-js");

// Numbers typed without a country code are assumed local to the chapter.
// Anything international must be entered with its "+" prefix.
const DEFAULT_COUNTRY = "CA";

// Phones are stored in E.164 ("+353831234567") — one canonical shape, no
// display punctuation in the database. Formatting for humans happens in the UI.
//
// Unparseable input is kept verbatim rather than rejected: the roster is filled
// in by hand and imported from spreadsheets, and a half-typed number shouldn't
// block saving the rest of a brother's record.
function toE164(input, defaultCountry = DEFAULT_COUNTRY) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  return parsed && parsed.isValid() ? parsed.number : raw;
}

// True when the value is already canonical — used by the migration's dry run.
function isE164(value) {
  return typeof value === "string" && /^\+[1-9]\d{6,14}$/.test(value);
}

module.exports = { toE164, isE164, DEFAULT_COUNTRY };
