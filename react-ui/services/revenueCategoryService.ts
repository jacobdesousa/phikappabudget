import { IRevenueCategory, ICategoryYearState } from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function addRevenueCategory(revenueCategory: IRevenueCategory, schoolYear?: number) {
    try {
        const response = await apiClient.post('/revenue/category', { ...revenueCategory, school_year: schoolYear });
        return response.status;
    } catch (error) {
        return 400;
    }
}

// Pass a school year to get only the categories that year offers; omit it for
// the full list.
export async function getRevenueCategories(schoolYear?: number): Promise<Array<IRevenueCategory>> {
    try {
        const response = await apiClient.get('/revenue/category', {
            params: schoolYear ? { school_year: schoolYear } : undefined,
        });
        return response.data;
    } catch (error) {
        return [];
    }
}

export async function getRevenueCategoryYear(schoolYear: number): Promise<ICategoryYearState> {
    const res = await apiClient.get('/revenue/category-years', { params: { school_year: schoolYear } });
    return res.data;
}

export async function addRevenueCategoryToYear(id: number, schoolYear: number) {
    try {
        const res = await apiClient.put(`/revenue/category/${id}/years/${schoolYear}`);
        return { ok: true, status: res.status as number };
    } catch (e) {
        const apiError = parseApiError(e);
        return { ok: false, status: apiError.status || 400, error: apiError };
    }
}

// Moves that year's entries to Misc; other years keep the category.
export async function removeRevenueCategoryFromYear(id: number, schoolYear: number) {
    try {
        const res = await apiClient.delete(`/revenue/category/${id}/years/${schoolYear}`);
        return { ok: true, status: res.status as number, data: res.data as { reassigned: number } };
    } catch (e) {
        const apiError = parseApiError(e);
        return { ok: false, status: apiError.status || 400, error: apiError };
    }
}

export async function importRevenueCategoryYear(fromYear: number, toYear: number) {
    try {
        const res = await apiClient.post('/revenue/category-years/import', {
            from_year: fromYear,
            to_year: toYear,
        });
        return { ok: true, status: res.status as number, data: res.data as { imported: number } };
    } catch (e) {
        const apiError = parseApiError(e);
        return { ok: false, status: apiError.status || 400, error: apiError };
    }
}

export async function updateRevenueCategory(id: number, update: Pick<IRevenueCategory, "name">) {
    try {
        const res = await apiClient.put(`/revenue/category/${id}`, update);
        return { ok: true, status: res.status as number, data: res.data as IRevenueCategory };
    } catch (e) {
        const apiError = parseApiError(e);
        return { ok: false, status: apiError.status || 400, error: apiError };
    }
}

export async function deleteRevenueCategory(id: number) {
    try {
        const res = await apiClient.delete(`/revenue/category/${id}`);
        return { ok: true, status: res.status as number };
    } catch (e) {
        const apiError = parseApiError(e);
        return { ok: false, status: apiError.status || 400, error: apiError };
    }
}