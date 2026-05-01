import { apiClient, parseApiError } from "./apiClient";
import type { IWorkday, IWorkdayListItem } from "../interfaces/api.interface";

export async function getWorkdays(): Promise<IWorkdayListItem[]> {
  const res = await apiClient.get("/workdays");
  return res.data;
}

export async function getWorkdaysForBonusMonth(month: string): Promise<Array<IWorkdayListItem & { summary?: any }>> {
  const res = await apiClient.get("/workdays", { params: { bonus_month: month, include_summary: 1 } });
  return res.data;
}

export async function getWorkday(id: number): Promise<IWorkday> {
  const res = await apiClient.get(`/workdays/${id}`);
  return res.data;
}

export async function createWorkday(payload: { workday_date: string; title?: string | null; bonus_month?: string | null }): Promise<{ ok: true; id: number } | { ok: false; status: number; error: string }> {
  try {
    const res = await apiClient.post("/workdays", payload);
    return { ok: true, id: res.data?.id };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function updateWorkday(
  id: number,
  payload: { workday_date: string; title?: string | null; bonus_month?: string | null; attendance: Array<{ brother_id: number; status: string; coveralls?: boolean | null; nametag?: boolean | null; makeup_completed_at?: string | null }> }
): Promise<{ ok: true; workday: IWorkday } | { ok: false; status: number; error: string }> {
  try {
    const res = await apiClient.put(`/workdays/${id}`, payload);
    return { ok: true, workday: res.data };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function deleteWorkday(id: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.delete(`/workdays/${id}`);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}


