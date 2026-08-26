import { schoolYearStartForDate } from "./schoolYear";
import { IBrother } from "../interfaces/api.interface";

// Was a brother an active member during a given school year?
//
// `status` is current state, so filtering on it answers "is this person active
// today" — which silently hid brothers from years they were present for, dues
// paid and all, the moment they were marked alumni. `alumni_date` records when
// the transition happened; a brother counts as active in any school year he was
// there for part of.
//
// There is deliberately no status check on the second branch. alumni_date is
// only ever set when someone leaves active membership, so its presence is
// itself the signal — which covers "Chapter Eternal", "Surrendered" and the
// rest, not just "Alumnus". Statuses that were never active (Pledge, Boarder)
// never get a date, so they stay excluded.
//
// Must stay in step with activeInYearSql / isActiveInYear in
// api/src/utils/membership.js — a mismatch here is invisible from the server.
export function isActiveInYear(brother: IBrother, year: number): boolean {
  if (brother.status === "Active") return true;
  if (!brother.alumni_date) return false;
  return schoolYearStartForDate(brother.alumni_date) >= year;
}
