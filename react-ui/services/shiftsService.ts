import {
  IShiftEvent,
  IShiftAssignment,
  IShiftPartyDuty,
  IShiftPartySlot,
  IShiftBrotherCount,
} from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function listShifts(type: string, school_year?: number): Promise<IShiftEvent[]> {
  try {
    const response = await apiClient.get("/shifts", { params: { type, school_year } });
    return response.data;
  } catch {
    return [];
  }
}

export async function getShift(id: number): Promise<IShiftEvent | null> {
  try {
    const response = await apiClient.get(`/shifts/${id}`);
    return response.data;
  } catch {
    return null;
  }
}

export async function createShift(payload: {
  shift_type: string;
  event_date: string;
  title?: string | null;
  notes?: string | null;
  party_start_time?: string | null;
  party_end_time?: string | null;
  duties?: string[];
}) {
  try {
    const response = await apiClient.post("/shifts", payload);
    return { ok: true, data: response.data as IShiftEvent };
  } catch (e) {
    return { ok: false, error: parseApiError(e) };
  }
}

export async function updateShift(
  id: number,
  payload: {
    event_date?: string;
    title?: string | null;
    notes?: string | null;
    party_start_time?: string | null;
    party_end_time?: string | null;
    assignments?: Partial<IShiftAssignment>[];
    slots?: Partial<IShiftPartySlot>[];
  }
) {
  try {
    const response = await apiClient.put(`/shifts/${id}`, payload);
    return { ok: true, data: response.data as IShiftEvent };
  } catch (e) {
    return { ok: false, error: parseApiError(e) };
  }
}

export async function deleteShift(id: number) {
  try {
    await apiClient.delete(`/shifts/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: parseApiError(e) };
  }
}

export async function getBrotherCounts(type: string, school_year?: number): Promise<IShiftBrotherCount[]> {
  try {
    const response = await apiClient.get("/shifts/counts", { params: { type, school_year } });
    return response.data;
  } catch {
    return [];
  }
}

export async function listPartyDuties(shiftId: number): Promise<IShiftPartyDuty[]> {
  try {
    const response = await apiClient.get(`/shifts/${shiftId}/duties`);
    return response.data;
  } catch {
    return [];
  }
}

export async function createPartyDuty(shiftId: number, payload: { name: string; display_order?: number }) {
  try {
    const response = await apiClient.post(`/shifts/${shiftId}/duties`, payload);
    return { ok: true, data: response.data as IShiftPartyDuty };
  } catch (e) {
    return { ok: false, error: parseApiError(e) };
  }
}

export async function updatePartyDuty(dutyId: number, payload: { name?: string; display_order?: number }) {
  try {
    const response = await apiClient.put(`/shift-duties/${dutyId}`, payload);
    return { ok: true, data: response.data as IShiftPartyDuty };
  } catch (e) {
    return { ok: false, error: parseApiError(e) };
  }
}

export async function deletePartyDuty(dutyId: number) {
  try {
    await apiClient.delete(`/shift-duties/${dutyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: parseApiError(e) };
  }
}
