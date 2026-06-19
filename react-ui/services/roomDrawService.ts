import { IRoomDrawLegacyAdjustment, IRoomDrawStanding } from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function getStandings(): Promise<IRoomDrawStanding[]> {
    try {
        const res = await apiClient.get("/room-draw/standings");
        return res.data;
    } catch {
        return [];
    }
}

export async function getLegacyAdjustments(): Promise<IRoomDrawLegacyAdjustment[]> {
    try {
        const res = await apiClient.get("/room-draw/legacy");
        return res.data;
    } catch {
        return [];
    }
}

export async function addLegacyAdjustment(adj: { brother_id: number; points: number; reason: string; category: "committee" | "legacy" }) {
    try {
        const res = await apiClient.post("/room-draw/legacy", adj);
        return { ok: true, status: res.status, data: res.data as IRoomDrawLegacyAdjustment };
    } catch (e) {
        const apiError = parseApiError(e);
        return { ok: false, status: apiError.status || 400, error: apiError };
    }
}

export async function deleteLegacyAdjustment(id: number) {
    try {
        const res = await apiClient.delete(`/room-draw/legacy/${id}`);
        return { ok: true, status: res.status };
    } catch (e) {
        const apiError = parseApiError(e);
        return { ok: false, status: apiError.status || 400, error: apiError };
    }
}
