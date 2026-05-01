import { apiClient, parseApiError } from "./apiClient";
import { IExpenseCategory } from "../interfaces/api.interface";

export async function getExpenseCategories(): Promise<IExpenseCategory[]> {
  try {
    const res = await apiClient.get("/expenses/category");
    return res.data;
  } catch {
    return [];
  }
}

export async function addExpenseCategory(category: IExpenseCategory) {
  try {
    const res = await apiClient.post("/expenses/category", category);
    return { ok: true, status: res.status as number, data: res.data as IExpenseCategory };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function updateExpenseCategory(id: number, update: Pick<IExpenseCategory, "name">) {
  try {
    const res = await apiClient.put(`/expenses/category/${id}`, update);
    return { ok: true, status: res.status as number, data: res.data as IExpenseCategory };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function deleteExpenseCategory(id: number) {
  try {
    const res = await apiClient.delete(`/expenses/category/${id}`);
    return { ok: true, status: res.status as number };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}


