import { apiClient, parseApiError } from "./apiClient";
import { IExpense } from "../interfaces/api.interface";

export async function submitExpenseWithReceipt(input: {
  submitter_name?: string;
  submitter_brother_id?: number;
  category_id?: number | null;
  amount: number;
  date?: string;
  description?: string;
  receipt: File;
}) {
  try {
    const fd = new FormData();
    if (input.submitter_name) fd.append("submitter_name", input.submitter_name);
    if (input.submitter_brother_id) fd.append("submitter_brother_id", String(input.submitter_brother_id));
    if (input.category_id) fd.append("category_id", String(input.category_id));
    fd.append("amount", String(input.amount));
    if (input.date) fd.append("date", input.date);
    if (input.description) fd.append("description", input.description);
    fd.append("receipt", input.receipt);

    const res = await apiClient.post("/expenses/submit", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { ok: true, status: res.status as number, data: res.data as IExpense };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function approveExpense(id: number) {
  try {
    const res = await apiClient.post(`/expenses/${id}/approve`);
    return { ok: true, status: res.status as number };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function rejectExpense(id: number) {
  try {
    const res = await apiClient.post(`/expenses/${id}/reject`);
    return { ok: true, status: res.status as number };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function getOutstandingDisbursements() {
  try {
    const res = await apiClient.get("/expenses/disbursements/outstanding");
    return res.data as {
      year: number;
      total: number;
      by_brother: Array<{ brother_id: number; first_name: string; last_name: string; total: number; count: number }>;
      expenses: IExpense[];
    };
  } catch {
    return { year: 0, total: 0, by_brother: [], expenses: [] };
  }
}

export async function disburseExpenses(chequeNumber: string, expenseIds: number[]) {
  try {
    const res = await apiClient.post("/expenses/disbursements", {
      cheque_number: chequeNumber,
      expense_ids: expenseIds,
    });
    return { ok: true, status: res.status as number, data: res.data as any };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}


