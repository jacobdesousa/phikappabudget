import { IBrother } from "../interfaces/api.interface";

// Sorting the roster.
//
// Kept out of the table component so the comparators can be reasoned about on
// their own — pledge class in particular does not sort as the string it looks
// like.

export type BrotherSortKey = "name" | "last_name" | "pledge_class" | "graduation" | "status";
export type SortDirection = "asc" | "desc";

/**
 * "Fall 2023" is a date, not a word. Sorted as text, Fall would come before
 * Spring and 2019 would sit next to 2023 only by luck, so it becomes a number:
 * the year, with Spring ahead of Fall because a Spring class pledged earlier
 * in that calendar year.
 */
function pledgeClassRank(value?: string | null): number | null {
  const m = String(value ?? "")
    .trim()
    .match(/^(Fall|Spring)\s+(\d{4})$/i);
  if (!m) return null;
  const year = Number(m[2]);
  if (!Number.isFinite(year)) return null;
  return year * 10 + (m[1].toLowerCase() === "spring" ? 0 : 1);
}

function text(value?: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * A year, or null when there isn't one.
 *
 * Number(null) is 0, not NaN, so testing with Number.isFinite alone let a
 * brother with no graduation year sort as though they graduated in year zero —
 * straight to the top of an ascending sort.
 */
function year(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compare on one key. Returns a plain ascending comparison; direction is
 * applied by the caller so "missing sorts last" survives the flip.
 */
function compareBy(key: BrotherSortKey, a: IBrother, b: IBrother): number {
  switch (key) {
    case "pledge_class": {
      const ra = pledgeClassRank(a.pledge_class);
      const rb = pledgeClassRank(b.pledge_class);
      // A blank or unparseable pledge class has no place on the timeline, so
      // it goes to the end rather than pretending to be year zero.
      if (ra == null && rb == null) return 0;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
    }
    case "graduation": {
      const ga = year(a.graduation);
      const gb = year(b.graduation);
      if (ga == null && gb == null) return 0;
      if (ga == null) return 1;
      if (gb == null) return -1;
      return ga - gb;
    }
    case "last_name":
      return text(a.last_name).localeCompare(text(b.last_name));
    case "status":
      return text(a.status).localeCompare(text(b.status));
    case "name":
    default:
      return text(a.first_name).localeCompare(text(b.first_name));
  }
}

/**
 * A new array, sorted. Ties fall back to name so the order is stable between
 * renders — two brothers in the same pledge class should not swap places when
 * the list reloads.
 */
export function sortBrothers(
  rows: IBrother[],
  key: BrotherSortKey,
  direction: SortDirection
): IBrother[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const primary = compareBy(key, a, b);
    if (primary !== 0) {
      // Rows with nothing to sort on stay at the bottom either way: flipping
      // the direction should not promote the blanks to the top.
      const aMissing = compareBy(key, a, a) === 0 && isMissing(key, a);
      const bMissing = compareBy(key, b, b) === 0 && isMissing(key, b);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      return primary * sign;
    }
    const byName =
      text(a.first_name).localeCompare(text(b.first_name)) ||
      text(a.last_name).localeCompare(text(b.last_name));
    return byName;
  });
}

function isMissing(key: BrotherSortKey, row: IBrother): boolean {
  if (key === "pledge_class") return pledgeClassRank(row.pledge_class) == null;
  if (key === "graduation") return year(row.graduation) == null;
  return false;
}
