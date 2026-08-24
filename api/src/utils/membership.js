const { toLocalDate, schoolYearStartForDate } = require("./schoolYear");

// Was a brother an active member during a given school year?
//
// `brothers.status` only holds current state, so on its own it answers "is this
// person active today" — not "were they active in 2025-26". Marking someone
// alumni used to rewrite the past: the budget's dues count shrank for years
// already closed, and brothers who had paid in full vanished from the dues page
// and the revenue summary. `alumni_date` records WHEN active membership ended,
// so earlier years still resolve.
//
// The test is "active for any part of the school year". A brother who left
// partway through a year was there for the start of it — he was on the roster
// and he owed dues — so the year still counts. That makes the rule a single
// comparison against the year's Sept 1 start:
//
//   alumni_date >= Sept 1 of year Y
//
// A date also handles a mid-year departure honestly, which a bare year could
// not express.
//
// Note there is no status check on that second branch. `alumni_date` is only
// ever set when someone leaves active membership, so its presence is itself the
// signal — which means this covers "Chapter Eternal", "Surrendered" and the
// rest for free, not just "Alumnus". Statuses that were never active (Pledge,
// Boarder) never get a date, so they stay excluded exactly as before.
//
// Anyone departed with no alumni_date on file stays excluded from every year,
// which is what a bare `status = 'Active'` check did before — unknown history
// degrades to the old behaviour rather than inventing a date.

// SQL predicate for "was an active member in the given school year". `alias` is
// the brothers table alias; `yearParam` is the placeholder holding the
// school-year start, e.g. "$1". A fragment rather than a view, so it drops into
// the existing joins untouched.
function activeInYearSql(alias, yearParam) {
  return `(
    ${alias}.status = 'Active'
    OR (
      ${alias}.alumni_date IS NOT NULL
      AND ${alias}.alumni_date >= make_date(${yearParam}::int, 9, 1)
    )
  )`;
}

// The same test in JS, for rows already loaded.
function isActiveInYear(brother, year) {
  if (!brother) return false;
  if (brother.status === "Active") return true;
  if (!brother.alumni_date) return false;
  // Comparing school years rather than raw dates keeps this identical to the
  // SQL above without re-deriving the Sept 1 boundary here.
  return schoolYearStartForDate(toLocalDate(brother.alumni_date)) >= Number(year);
}

module.exports = { activeInYearSql, isActiveInYear };
