import { IBrother } from "../interfaces/api.interface";

// Roster filter buckets. The status list is longer than the roster usually
// cares about, so the rarely-used ones (Restricted, Suspended, Revoked, Chapter
// Eternal, Surrendered) collapse into "Other" rather than each getting a
// toggle. Every status lands in exactly one bucket, so nothing can hide from
// every filter at once.

export type BrotherGroup = "active" | "pledge" | "alumni" | "boarder" | "other";

export const BROTHER_GROUPS: { key: BrotherGroup; label: string }[] = [
  { key: "active", label: "Actives" },
  { key: "pledge", label: "Pledges" },
  { key: "alumni", label: "Alumni" },
  { key: "boarder", label: "Boarders" },
  { key: "other", label: "Other" },
];

export function groupForBrother(brother: IBrother): BrotherGroup {
  switch (brother.status) {
    case "Active":
      return "active";
    case "Pledge":
      return "pledge";
    case "Alumnus":
      return "alumni";
    case "Boarder":
      return "boarder";
    default:
      return "other";
  }
}

export function countByGroup(brothers: IBrother[]): Record<BrotherGroup, number> {
  const counts: Record<BrotherGroup, number> = {
    active: 0,
    pledge: 0,
    alumni: 0,
    boarder: 0,
    other: 0,
  };
  for (const b of brothers) counts[groupForBrother(b)] += 1;
  return counts;
}
