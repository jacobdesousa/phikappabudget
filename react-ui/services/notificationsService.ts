import { apiClient } from "./apiClient";

export interface UpcomingShift {
  id: number;
  shift_type: "setup" | "cleanup" | "party";
  event_date: string;
  title?: string | null;
}

export interface INotifications {
  upcoming_shifts: UpcomingShift[];
}

export async function getNotifications(): Promise<INotifications> {
  const res = await apiClient.get("/notifications");
  return res.data;
}

// Rows carry both outstanding and completed makeups; a makeup_completed_at
// value is what makes one completed.
interface MakeupBase {
  // Primary key of the attendance/assignment/slot row — what the PATCH targets.
  id: number;
  brother_id: number;
  first_name: string;
  last_name: string;
  status: string;
  makeup_completed_at?: string | null;
  makeup_assignment?: string | null;
}

export interface AllMakeupsWorkday extends MakeupBase {
  workday_id: number;
  workday_date: string;
  title?: string | null;
}

export interface AllMakeupsShift extends MakeupBase {
  shift_id: number;
  event_date: string;
  shift_type: "setup" | "cleanup" | "party";
  title?: string | null;
}

// Party absences come from the duty slots, so they carry the duty and the hour
// the brother was down for.
export interface AllMakeupsParty extends AllMakeupsShift {
  duty_name: string;
  slot_start: string;
}

export interface IAllMakeups {
  workday_makeups: AllMakeupsWorkday[];
  // Setup and cleanup only.
  shift_makeups: AllMakeupsShift[];
  party_makeups: AllMakeupsParty[];
}

export async function getAllMakeups(): Promise<IAllMakeups> {
  const res = await apiClient.get("/makeups");
  return res.data;
}

export type MakeupKind = "workday" | "shift" | "party";

// Partial patch: omit a field to leave it alone, pass null to clear it.
export async function updateMakeup(
  kind: MakeupKind,
  id: number,
  patch: { makeup_completed_at?: string | null; makeup_assignment?: string | null }
): Promise<void> {
  await apiClient.patch(`/makeups/${kind}/${id}`, patch);
}
