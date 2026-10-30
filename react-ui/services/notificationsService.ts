import { apiClient } from "./apiClient";

export type FeedKind =
  | "dues_due"
  | "house_fee_due"
  | "shift"
  | "workday"
  | "chore_duty"
  | "makeup";

export type FeedSeverity = "info" | "warning" | "urgent";

export interface FeedItem {
  // Stable per occurrence — this is what a read mark is stored against.
  key: string;
  kind: FeedKind;
  group: "money" | "activity";
  title: string;
  detail?: string | null;
  date: string;
  // Negative once the date has passed.
  days_until: number;
  severity: FeedSeverity;
  amount?: number | null;
  href: string;
  read: boolean;
  read_at?: string | null;
}

export interface INotifications {
  as_of: string;
  // Null for an account with no brother record — the feed is empty by design.
  brother_id: number | null;
  items: FeedItem[];
  counts: { total: number; unread: number; by_kind: Partial<Record<FeedKind, number>> };
}

export async function getNotifications(): Promise<INotifications> {
  const res = await apiClient.get("/notifications");
  return res.data;
}

/** Mark specific items read, or pass read: false to put them back to unread. */
export async function markNotificationsRead(keys: string[], read = true): Promise<void> {
  if (keys.length === 0) return;
  await apiClient.post("/notifications/read", { keys, read });
}

/** Marks everything currently in the feed — not anything that appears later. */
export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post("/notifications/read-all");
}

export type EmailKind = "weekly_digest" | "dues_due" | "house_fee_due";

// Every switch is on unless the brother turns it off; `all` silences the lot.
export interface IEmailPrefs {
  all: boolean;
  weekly_digest: boolean;
  dues_due: boolean;
  house_fee_due: boolean;
}

export async function getEmailPrefs(): Promise<{ brother_id: number | null; prefs: IEmailPrefs | null }> {
  const res = await apiClient.get("/notifications/preferences");
  return res.data;
}

export async function updateEmailPrefs(
  patch: Partial<IEmailPrefs>
): Promise<{ brother_id: number; prefs: IEmailPrefs }> {
  const res = await apiClient.put("/notifications/preferences", patch);
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
