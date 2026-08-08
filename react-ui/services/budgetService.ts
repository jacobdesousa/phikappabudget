import { IBudgetReconciliation, IBudgetSummary } from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function getBudgetSummary(year?: number): Promise<IBudgetSummary> {
  try {
    const params = year ? `?year=${year}` : "";
    const res = await apiClient.get(`/budget/summary${params}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function saveExpenseAllocations(
  year: number,
  rows: { category_id: number; budgeted_amount: number }[]
): Promise<void> {
  try {
    await apiClient.put(`/budget/expense-allocations?year=${year}`, { rows });
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function saveRevenueAllocations(
  year: number,
  rows: { category_id: number; budgeted_amount: number }[]
): Promise<void> {
  try {
    await apiClient.put(`/budget/revenue-allocations?year=${year}`, { rows });
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function saveReconciliation(
  year: number,
  data: IBudgetReconciliation
): Promise<void> {
  try {
    await apiClient.put(`/budget/reconciliation?year=${year}`, data);
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}
