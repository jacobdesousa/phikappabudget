import {
  IHouseAccount,
  IHouseAccountAdjustment,
  IHouseDisbursement,
} from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function getHouseAccount(year: number): Promise<IHouseAccount> {
  try {
    const res = await apiClient.get(`/house/account?year=${year}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function createDisbursement(
  payload: Partial<IHouseDisbursement>
): Promise<IHouseDisbursement> {
  try {
    const res = await apiClient.post(`/house/disbursements`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function updateDisbursement(
  id: number,
  payload: Partial<IHouseDisbursement>
): Promise<IHouseDisbursement> {
  try {
    const res = await apiClient.put(`/house/disbursements/${id}`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function deleteDisbursement(id: number): Promise<void> {
  try {
    await apiClient.delete(`/house/disbursements/${id}`);
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

// Records the chapter's share as an ordinary revenue row. Refused by the API if
// that share has already been posted.
export async function postDisbursementRevenue(
  id: number,
  payload: { payee?: string; date?: string; description?: string } = {}
): Promise<IHouseDisbursement> {
  try {
    const res = await apiClient.post(`/house/disbursements/${id}/post-revenue`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function getAccountAdjustments(year: number): Promise<IHouseAccountAdjustment[]> {
  try {
    const res = await apiClient.get(`/house/account/adjustments?year=${year}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function createAccountAdjustment(
  payload: Partial<IHouseAccountAdjustment>
): Promise<IHouseAccountAdjustment> {
  try {
    const res = await apiClient.post(`/house/account/adjustments`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function updateAccountAdjustment(
  id: number,
  payload: Partial<IHouseAccountAdjustment>
): Promise<IHouseAccountAdjustment> {
  try {
    const res = await apiClient.put(`/house/account/adjustments/${id}`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function deleteAccountAdjustment(id: number): Promise<void> {
  try {
    await apiClient.delete(`/house/account/adjustments/${id}`);
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}
