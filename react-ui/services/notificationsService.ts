import { apiClient } from "./apiClient";

export interface UpcomingWorkday {
  id: number;
  workday_date: string;
  title?: string | null;
}

export interface UpcomingShift {
  id: number;
  shift_type: "setup" | "cleanup" | "party";
  event_date: string;
  title?: string | null;
}

export interface UpcomingMeeting {
  id: number;
  meeting_date: string;
  title?: string | null;
}

export interface WorkdayMakeup {
  id: number;
  workday_date: string;
  title?: string | null;
  status: string;
}

export interface ShiftMakeup {
  id: number;
  event_date: string;
  shift_type: "setup" | "cleanup" | "party";
  title?: string | null;
  status: string;
}

export interface INotifications {
  upcoming_workdays: UpcomingWorkday[];
  upcoming_shifts: UpcomingShift[];
  upcoming_meetings: UpcomingMeeting[];
  workday_makeups: WorkdayMakeup[];
  shift_makeups: ShiftMakeup[];
}

export async function getNotifications(): Promise<INotifications> {
  const res = await apiClient.get("/notifications");
  return res.data;
}

export interface AllMakeupsWorkday {
  workday_id: number;
  workday_date: string;
  title?: string | null;
  brother_id: number;
  first_name: string;
  last_name: string;
  status: string;
}

export interface AllMakeupsShift {
  shift_id: number;
  event_date: string;
  shift_type: "setup" | "cleanup" | "party";
  title?: string | null;
  brother_id: number;
  first_name: string;
  last_name: string;
  status: string;
}

export interface IAllMakeups {
  workday_makeups: AllMakeupsWorkday[];
  shift_makeups: AllMakeupsShift[];
}

export async function getAllMakeups(): Promise<IAllMakeups> {
  const res = await apiClient.get("/makeups");
  return res.data;
}
