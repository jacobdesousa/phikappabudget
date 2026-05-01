import { apiClient, parseApiError } from "./apiClient";
import type { IVote, IVoteResult } from "../interfaces/api.interface";

export type VoteCreatePayload = {
    question: string;
    options: string[];
    allow_multiple: boolean;
    is_anonymous: boolean;
};

export async function listVotesForMeeting(meetingId: number): Promise<IVote[]> {
    const res = await apiClient.get(`/meetings/${meetingId}/votes`);
    return res.data;
}

export async function createVote(
    meetingId: number,
    payload: VoteCreatePayload
): Promise<{ ok: true; data: IVote } | { ok: false; error: string }> {
    try {
        const res = await apiClient.post(`/meetings/${meetingId}/votes`, payload);
        return { ok: true, data: res.data };
    } catch (e) {
        return { ok: false, error: parseApiError(e).message };
    }
}

export async function getVote(voteId: number): Promise<IVote> {
    const res = await apiClient.get(`/votes/${voteId}`);
    return res.data;
}

export async function getVoteResults(voteId: number): Promise<IVoteResult> {
    const res = await apiClient.get(`/votes/${voteId}/results`);
    return res.data;
}

export async function submitVoteResponse(
    voteId: number,
    option_ids: number[]
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        await apiClient.post(`/votes/${voteId}/respond`, { option_ids });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: parseApiError(e).message };
    }
}

export async function closeVote(voteId: number): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        await apiClient.put(`/votes/${voteId}/close`, {});
        return { ok: true };
    } catch (e) {
        return { ok: false, error: parseApiError(e).message };
    }
}

export async function deleteVote(voteId: number): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        await apiClient.delete(`/votes/${voteId}`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: parseApiError(e).message };
    }
}

export async function setVoteResultsVisible(voteId: number, visible: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        await apiClient.put(`/votes/${voteId}/results-visible`, { visible });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: parseApiError(e).message };
    }
}
