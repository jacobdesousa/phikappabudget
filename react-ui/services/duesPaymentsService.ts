import { apiClient, parseApiError } from "./apiClient";
import { IDuesPayment, IDuesSummaryRow } from "../interfaces/api.interface";

export async function getDuesSummary(year?: number): Promise<IDuesSummaryRow[]> {
  try {
    const res = await apiClient.get("/dues/summary", {
      params: year ? { year } : undefined,
    });
    return res.data;
  } catch {
    return [];
  }
}

export async function getPaymentsForBrother(
  brotherId: number,
  year?: number
): Promise<IDuesPayment[]> {
  try {
    const res = await apiClient.get("/dues/payments", {
      params: year ? { brother_id: brotherId, year } : { brother_id: brotherId },
    });
    return res.data;
  } catch {
    return [];
  }
}

export async function addPayment(payment: IDuesPayment) {
  try {
    const res = await apiClient.post("/dues/payments", payment);
    return { ok: true, status: res.status as number, data: res.data as IDuesPayment };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function updatePayment(
  id: number,
  update: Partial<Pick<IDuesPayment, "paid_at" | "amount" | "memo">>
) {
  try {
    const res = await apiClient.put(`/dues/payments/${id}`, update);
    return { ok: true, status: res.status as number, data: res.data as IDuesPayment };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function deletePayment(id: number) {
  try {
    const res = await apiClient.delete(`/dues/payments/${id}`);
    return { ok: true, status: res.status as number };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}


