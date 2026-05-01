import { apiClient, parseApiError } from "./apiClient";
import type { IMeetingMinutes, IMeetingMinutesListItem } from "../interfaces/api.interface";

export async function getMeetings(): Promise<IMeetingMinutesListItem[]> {
  const res = await apiClient.get("/meetings");
  return res.data;
}

export async function getMeeting(id: number): Promise<IMeetingMinutes> {
  const res = await apiClient.get(`/meetings/${id}`);
  return res.data;
}

export type MeetingUpsertPayload = {
  meeting_date: string | Date;
  title?: string | null;
  communications?: string | null;
  old_business?: string | null;
  new_business?: string | null;
  betterment?: string | null;
  motion_accept_moved_by_brother_id?: number | null;
  motion_accept_seconded_by_brother_id?: number | null;
  motion_end_moved_by_brother_id?: number | null;
  motion_end_seconded_by_brother_id?: number | null;
  attendance: Array<{
    brother_id?: number | null;
    member_name?: string | null;
    status: string;
    late_arrival_time?: string | null;
    excused_reason?: string | null;
  }>;
  officer_notes?: Array<{
    officer_key: string;
    notes?: string | null;
  }>;
};

export async function createMeeting(payload: MeetingUpsertPayload): Promise<{ ok: true; id: number } | { ok: false; status: number; error: string }> {
  try {
    const res = await apiClient.post("/meetings", payload);
    return { ok: true, id: res.data.id };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function updateMeeting(
  id: number,
  payload: MeetingUpsertPayload
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.put(`/meetings/${id}`, payload);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function deleteMeeting(id: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.delete(`/meetings/${id}`);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}


