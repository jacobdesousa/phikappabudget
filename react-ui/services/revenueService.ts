import { IRevenue, IRevenueSummary } from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function getRevenue(year?: number): Promise<IRevenue[]> {
  try {
    const response = await apiClient.get("/revenue", {
      params: year ? { year } : undefined,
    });
    return response.data;
  } catch {
    return [];
  }
}

export async function addRevenue(revenue: IRevenue) {
  try {
    const response = await apiClient.post("/revenue", revenue);
    return { ok: true, status: response.status as number, data: response.data as IRevenue };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function updateRevenue(
  id: number,
  update: Partial<
    Pick<
      IRevenue,
      "date" | "description" | "category_id" | "cash_amount" | "square_amount" | "etransfer_amount" | "amount"
    >
  >
) {
  try {
    const res = await apiClient.put(`/revenue/${id}`, update);
    return { ok: true, status: res.status as number, data: res.data as IRevenue };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function deleteRevenue(id: number) {
  try {
    const res = await apiClient.delete(`/revenue/${id}`);
    return { ok: true, status: res.status as number };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function getRevenueSummary(year?: number): Promise<IRevenueSummary | null> {
  try {
    const response = await apiClient.get("/revenue/summary", {
      params: year ? { year } : undefined,
    });
    return response.data;
  } catch {
    return null;
  }
}