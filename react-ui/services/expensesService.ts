import { apiClient, parseApiError } from "./apiClient";
import { IExpense } from "../interfaces/api.interface";

export async function getExpenses(year?: number): Promise<IExpense[]> {
  try {
    const res = await apiClient.get("/expenses", {
      params: year ? { year } : undefined,
    });
    return res.data;
  } catch {
    return [];
  }
}

export async function addExpense(expense: IExpense) {
  try {
    const res = await apiClient.post("/expenses", expense);
    return { ok: true, status: res.status as number, data: res.data as IExpense };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function addExpenseWithReceipt(input: {
  date: string;
  description: string;
  category_id: number;
  amount: number;
  reimburse_brother_id?: number | null;
  cheque_number?: string | null;
  receipt: File;
}) {
  try {
    const fd = new FormData();
    fd.append("date", input.date);
    fd.append("description", input.description);
    fd.append("category_id", String(input.category_id));
    fd.append("amount", String(input.amount));
    if (input.reimburse_brother_id) fd.append("reimburse_brother_id", String(input.reimburse_brother_id));
    if (input.cheque_number) fd.append("cheque_number", input.cheque_number);
    fd.append("receipt", input.receipt);

    const res = await apiClient.post("/expenses/with-receipt", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { ok: true, status: res.status as number, data: res.data as IExpense };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function uploadExpenseReceipt(expenseId: number, receipt: File) {
  try {
    const fd = new FormData();
    fd.append("receipt", receipt);
    const res = await apiClient.post(`/expenses/${expenseId}/receipt`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { ok: true, status: res.status as number, data: res.data as IExpense };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function updateExpense(
  id: number,
  update: Partial<
    Pick<
      IExpense,
      "date" | "description" | "category_id" | "amount" | "reimburse_brother_id" | "cheque_number"
    >
  >
) {
  try {
    const res = await apiClient.put(`/expenses/${id}`, update);
    return { ok: true, status: res.status as number, data: res.data as IExpense };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function deleteExpense(id: number) {
  try {
    const res = await apiClient.delete(`/expenses/${id}`);
    return { ok: true, status: res.status as number };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}


