import { apiClient } from "./apiClient";

export type OfficeListItem = {
  office_key: string;
  display_name: string;
};

export async function getOffices(): Promise<OfficeListItem[]> {
  const res = await apiClient.get("/offices");
  return res.data;
}


