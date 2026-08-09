import {
  IHouseConfig,
  IHousePayee,
  IHouseRoomRate,
  IHouseSession,
} from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export async function getHouseConfig(year: number): Promise<IHouseConfig> {
  try {
    const res = await apiClient.get(`/house/config?year=${year}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function saveHouseConfig(payload: {
  year: number;
  sessions?: IHouseSession[];
  rates?: IHouseRoomRate[];
  payees?: IHousePayee[];
}): Promise<void> {
  try {
    await apiClient.put(`/house/config`, payload);
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

// `from` copies a prior year forward; omit it to lay down the fee-schedule defaults.
export async function seedHouseConfig(year: number, from?: number): Promise<void> {
  try {
    await apiClient.post(`/house/config/seed`, from ? { year, from } : { year });
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}
