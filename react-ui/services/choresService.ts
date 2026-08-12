import {
  IChoreCaptain,
  IChoreConfig,
  IChoreCurrent,
  IChoreDuty,
  IChoreGridCell,
  IChoreSchedule,
  IChoreSettings,
} from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function getCurrentChores(date?: string): Promise<IChoreCurrent> {
  try {
    const res = await apiClient.get(`/chores/current${date ? `?date=${date}` : ""}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function getChoreSchedule(params: {
  year?: number;
  from?: string;
  to?: string;
}): Promise<IChoreSchedule> {
  try {
    const qs = new URLSearchParams();
    if (params.year) qs.set("year", String(params.year));
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    const res = await apiClient.get(`/chores/schedule?${qs.toString()}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function getChoreConfig(): Promise<IChoreConfig> {
  try {
    const res = await apiClient.get(`/chores/config`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function saveChoreConfig(payload: {
  settings: IChoreSettings;
  duties: IChoreDuty[];
  grid: IChoreGridCell[];
  captains: IChoreCaptain[];
}): Promise<IChoreConfig> {
  try {
    const res = await apiClient.put(`/chores/config`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

// Lays down the duties, grid, and captains from the printed schedule.
// `reset` replaces what is there instead of filling gaps.
export async function seedChoreConfig(reset = false): Promise<IChoreConfig> {
  try {
    const res = await apiClient.post(`/chores/config/seed`, { reset });
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}
