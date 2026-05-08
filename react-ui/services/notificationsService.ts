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
