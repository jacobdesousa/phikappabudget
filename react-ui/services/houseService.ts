import {
  HouseSessionType,
  IHouseAssignment,
  IHouseDeposit,
  IHousePayment,
  IHouseRoster,
  IHouseSummary,
} from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

function yearSession(year: number, session: HouseSessionType) {
  return `?year=${year}&session=${session}`;
}

export async function getHouseRoster(year: number, session: HouseSessionType): Promise<IHouseRoster> {
  try {
    const res = await apiClient.get(`/house/roster${yearSession(year, session)}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function getHouseSummary(year: number, session: HouseSessionType): Promise<IHouseSummary> {
  try {
    const res = await apiClient.get(`/house/summary${yearSession(year, session)}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function createAssignment(payload: Partial<IHouseAssignment>): Promise<IHouseAssignment> {
  try {
    const res = await apiClient.post(`/house/assignments`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function updateAssignment(
  id: number,
  payload: Partial<IHouseAssignment>
): Promise<IHouseAssignment> {
  try {
    const res = await apiClient.put(`/house/assignments/${id}`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function deleteAssignment(id: number): Promise<void> {
  try {
    await apiClient.delete(`/house/assignments/${id}`);
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function getHousePayments(params: {
  brother_id?: number;
  year?: number;
  session?: HouseSessionType;
}): Promise<IHousePayment[]> {
  try {
    const qs = new URLSearchParams();
    if (params.brother_id) qs.set("brother_id", String(params.brother_id));
    if (params.year) qs.set("year", String(params.year));
    if (params.session) qs.set("session", params.session);
    const res = await apiClient.get(`/house/payments?${qs.toString()}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function createHousePayment(payload: Partial<IHousePayment>): Promise<IHousePayment> {
  try {
    const res = await apiClient.post(`/house/payments`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function updateHousePayment(
  id: number,
  payload: Partial<IHousePayment>
): Promise<IHousePayment> {
  try {
    const res = await apiClient.put(`/house/payments/${id}`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function deleteHousePayment(id: number): Promise<void> {
  try {
    await apiClient.delete(`/house/payments/${id}`);
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function getHouseDeposits(brotherId?: number): Promise<IHouseDeposit[]> {
  try {
    const qs = brotherId ? `?brother_id=${brotherId}` : "";
    const res = await apiClient.get(`/house/deposits${qs}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function createHouseDeposit(payload: Partial<IHouseDeposit>): Promise<IHouseDeposit> {
  try {
    const res = await apiClient.post(`/house/deposits`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function updateHouseDeposit(
  id: number,
  payload: Partial<IHouseDeposit>
): Promise<IHouseDeposit> {
  try {
    const res = await apiClient.put(`/house/deposits/${id}`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function deleteHouseDeposit(id: number): Promise<void> {
  try {
    await apiClient.delete(`/house/deposits/${id}`);
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}
