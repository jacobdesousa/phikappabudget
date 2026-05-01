import { IBrother, IBrotherOffice } from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function getAllBrothers(): Promise<Array<IBrother>> {
    try {
        const response = await apiClient.get('/brothers');
        return response.data;
    } catch (error) {
        return [];
    }
}

export async function addBrother(brother: IBrother) {
    try {
        const response = await apiClient.post('/brothers', brother);
        return { ok: true, status: response.status as number };
    } catch (error) {
        const apiError = parseApiError(error);
        return { ok: false, status: apiError.status || 400, error: apiError };
    }
}

export async function editBrother(brother: IBrother, id: number) {
    try {
        const response = await apiClient.put('/brothers/' + id, brother);
        return { ok: true, status: response.status as number };
    } catch (error) {
        const apiError = parseApiError(error);
        return { ok: false, status: apiError.status || 400, error: apiError };
    }
}

export async function listBrotherOffices(brotherId: number): Promise<IBrotherOffice[]> {
    const res = await apiClient.get(`/brothers/${brotherId}/offices`);
    return res.data;
}

export async function assignBrotherOffice(
    brotherId: number,
    payload: { office_key: string; start_date: string; end_date?: string | null }
): Promise<{ ok: true; data: IBrotherOffice } | { ok: false; error: string }> {
    try {
        const res = await apiClient.post(`/brothers/${brotherId}/offices`, payload);
        return { ok: true, data: res.data };
    } catch (e) {
        return { ok: false, error: parseApiError(e).message };
    }
}

export async function updateBrotherOffice(
    tenureId: number,
    payload: { start_date?: string; end_date?: string | null }
): Promise<{ ok: true; data: IBrotherOffice } | { ok: false; error: string }> {
    try {
        const res = await apiClient.put(`/brother-offices/${tenureId}`, payload);
        return { ok: true, data: res.data };
    } catch (e) {
        return { ok: false, error: parseApiError(e).message };
    }
}

export async function deleteBrotherOffice(tenureId: number): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        await apiClient.delete(`/brother-offices/${tenureId}`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: parseApiError(e).message };
    }
}