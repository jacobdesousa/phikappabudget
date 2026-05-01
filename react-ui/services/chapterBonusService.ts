import { apiClient, parseApiError } from "./apiClient";
import type { IChapterBonusDeduction, IChapterBonusRule } from "../interfaces/api.interface";

export async function getBonusDeductions(month: string): Promise<IChapterBonusDeduction[]> {
  const res = await apiClient.get("/chapter-bonus/deductions", { params: { month } });
  return res.data;
}

export async function getBonusSummary(month: string): Promise<{ month: string; total: number }> {
  const res = await apiClient.get("/chapter-bonus/summary", { params: { month } });
  return res.data;
}

export async function addBonusDeduction(form: FormData): Promise<{ ok: true; id: number } | { ok: false; status: number; error: string }> {
  try {
    const res = await apiClient.post("/chapter-bonus/deductions", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { ok: true, id: res.data.id };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function deleteBonusDeduction(id: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.delete(`/chapter-bonus/deductions/${id}`);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function getBonusRules(): Promise<IChapterBonusRule[]> {
  const res = await apiClient.get("/chapter-bonus/rules");
  return res.data;
}

export async function upsertBonusRule(payload: {
  violation_type: string;
  description?: string | null;
  tiers: Array<{ tier_number: number; amount: number }>;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.post("/chapter-bonus/rules", payload);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function deleteBonusRule(id: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.delete(`/chapter-bonus/rules/${id}`);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function previewBonusPenalty(month: string, violation_type: string): Promise<{ month: string; violation_type: string; occurrence_number: number; amount: number }> {
  const res = await apiClient.get("/chapter-bonus/penalty", { params: { month, violation_type } });
  return res.data;
}

export async function getWorkdayRatesForMonth(month: string): Promise<{
  month: string;
  active_present_rate: number;
  active_late_rate: number;
  active_coveralls_rate: number;
  active_coveralls_nametag_rate: number;
  pledge_present_rate: number;
  pledge_late_rate: number;
}> {
  const res = await apiClient.get("/chapter-bonus/workday-rates", { params: { month } });
  return res.data;
}

export async function upsertWorkdayRatesForMonth(
  month: string,
  payload: {
    active_present_rate: number;
    active_late_rate: number;
    active_coveralls_rate: number;
    active_coveralls_nametag_rate: number;
    pledge_present_rate: number;
    pledge_late_rate: number;
  }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.put("/chapter-bonus/workday-rates", payload, { params: { month } });
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}


