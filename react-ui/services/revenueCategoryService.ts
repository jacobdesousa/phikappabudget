import { IRevenueCategory } from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function addRevenueCategory(revenueCategory: IRevenueCategory) {
    try {
        const response = await apiClient.post('/revenue/category', revenueCategory);
        return response.status;
    } catch (error) {
        return 400;
    }
}

export async function getRevenueCategories(): Promise<Array<IRevenueCategory>> {
    try {
        const response = await apiClient.get('/revenue/category');
        return response.data;
    } catch (error) {
        return [];
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