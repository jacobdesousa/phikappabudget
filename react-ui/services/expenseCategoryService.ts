import { apiClient, parseApiError } from "./apiClient";
import { IExpenseCategory, ICategoryYearState } from "../interfaces/api.interface";

// Pass a school year to get only the categories that year offers; omit it for
// the full list.
export async function getExpenseCategories(schoolYear?: number): Promise<IExpenseCategory[]> {
  try {
    const res = await apiClient.get("/expenses/category", {
      params: schoolYear ? { school_year: schoolYear } : undefined,
    });
    return res.data;
  } catch {
    return [];
  }
}

export async function getExpenseCategoryYear(schoolYear: number): Promise<ICategoryYearState> {
  const res = await apiClient.get("/expenses/category-years", {
    params: { school_year: schoolYear },
  });
  return res.data;
}

export async function addExpenseCategoryToYear(id: number, schoolYear: number) {
  try {
    const res = await apiClient.put(`/expenses/category/${id}/years/${schoolYear}`);
    return { ok: true, status: res.status as number };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

// Moves that year's entries to Misc; other years keep the category.
export async function removeExpenseCategoryFromYear(id: number, schoolYear: number) {
  try {
    const res = await apiClient.delete(`/expenses/category/${id}/years/${schoolYear}`);
    return { ok: true, status: res.status as number, data: res.data as { reassigned: number } };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function importExpenseCategoryYear(fromYear: number, toYear: number) {
  try {
    const res = await apiClient.post("/expenses/category-years/import", {
      from_year: fromYear,
      to_year: toYear,
    });
    return { ok: true, status: res.status as number, data: res.data as { imported: number } };
  } catch (e) {
    const apiError = parseApiError(e);
    return { ok: false, status: apiError.status || 400, error: apiError };
  }
}

export async function addExpenseCategory(category: IExpenseCategory, schoolYear?: number) {
  try {
    const res = await apiClient.post("/expenses/category", { ...category, school_year: schoolYear });
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


