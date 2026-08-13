import {
  IBondState,
  IDonation,
  IDonationConfig,
  IDonationPage,
  IDonationSummary,
} from "../interfaces/api.interface";
import { apiClient, parseApiError } from "./apiClient";

export interface DonationFilters {
  brother_id?: number | null;
  campaign_id?: number | null;
  year?: number | null;
  kind?: "bond" | "general" | null;
  // Donations pinned to no campaign — bond money and unattached gifts.
  no_campaign?: boolean;
  limit?: number;
  offset?: number;
}

export async function getDonations(filters: DonationFilters = {}): Promise<IDonationPage> {
  const params = new URLSearchParams();
  if (filters.brother_id) params.set("brother_id", String(filters.brother_id));
  if (filters.campaign_id) params.set("campaign_id", String(filters.campaign_id));
  if (filters.year) params.set("year", String(filters.year));
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.no_campaign) params.set("no_campaign", "true");
  params.set("limit", String(filters.limit ?? 100));
  params.set("offset", String(filters.offset ?? 0));

  try {
    const res = await apiClient.get(`/donations?${params.toString()}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function getDonationSummary(): Promise<IDonationSummary> {
  try {
    const res = await apiClient.get(`/donations/summary`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

// What the entry dialog needs to propose the bond/general split.
export async function getBondState(brotherId: number): Promise<IBondState> {
  try {
    const res = await apiClient.get(`/donations/bond/${brotherId}`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function updateBond(
  brotherId: number,
  payload: {
    bond_price: number;
    opened_on?: string | null;
    bond_number?: string | null;
    notes?: string | null;
  }
): Promise<IBondState> {
  try {
    const res = await apiClient.put(`/donations/bond/${brotherId}`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

// One gift in, one or two rows back — the server writes a second row when the
// gift runs past the outstanding bond.
export async function createDonation(payload: {
  brother_id: number;
  donated_on: string;
  amount: number;
  campaign_id?: number | null;
  note?: string | null;
  apply_to_bond: boolean;
  bond_amount?: number | null;
}): Promise<IDonation[]> {
  try {
    const res = await apiClient.post(`/donations`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function updateDonation(
  id: number,
  payload: Partial<{
    donated_on: string;
    amount: number;
    kind: "bond" | "general";
    campaign_id: number | null;
    note: string | null;
  }>
): Promise<IDonation> {
  try {
    const res = await apiClient.put(`/donations/${id}`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function deleteDonation(id: number): Promise<void> {
  try {
    await apiClient.delete(`/donations/${id}`);
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function getDonationConfig(): Promise<IDonationConfig> {
  try {
    const res = await apiClient.get(`/donations/config`);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}

export async function saveDonationConfig(payload: IDonationConfig): Promise<IDonationConfig> {
  try {
    const res = await apiClient.put(`/donations/config`, payload);
    return res.data;
  } catch (e) {
    throw new Error(parseApiError(e).message);
  }
}
