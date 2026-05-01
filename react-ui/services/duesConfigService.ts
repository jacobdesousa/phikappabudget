import { apiClient, parseApiError } from "./apiClient";
import { IDuesConfig } from "../interfaces/api.interface";

export async function getDuesConfig(year?: number): Promise<IDuesConfig | null> {
  try {
    const res = await apiClient.get("/dues/config", {
      params: year ? { year } : undefined,
    });
    return res.data;
  } catch {
    return null;
  }
}

export async function upsertDuesConfig(config: IDuesConfig) {
  try {
    const res = await apiClient.put("/dues/config", config);
    return { ok: true, status: res.status as number };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}


