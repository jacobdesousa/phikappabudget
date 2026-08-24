import { schoolYearStartForDate } from "./schoolYear";
import { IBrother } from "../interfaces/api.interface";

// Was a brother in the chapter during a given school year?
//
// `status` is current state, so filtering on it answers "is this person active
// today" — which silently hid brothers from years they were present for, dues
// paid and all, the moment they were marked alumni. `alumni_date` records when
// the transition happened; a brother counts as active in any school year he was
// there for part of.
//
// Mirrors activeInYearSql / isActiveInYear in api/src/utils/membership.js.
export function isActiveInYear(brother: IBrother, year: number): boolean {
  if (brother.status === "Active") return true;
  if (brother.status !== "Alumni") return false;
  if (!brother.alumni_date) return false;
  return schoolYearStartForDate(brother.alumni_date) >= year;
}
