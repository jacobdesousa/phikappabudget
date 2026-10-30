import { apiClient } from "./apiClient";

// What the account page shows under "Coming up". The notifications feed
// produces richer items than this; the page only needs these fields, and
// declaring them here keeps the account page independent of it.
export interface IAccountUpcoming {
  key: string;
  kind: string;
  title: string;
  detail?: string | null;
  date: string;
  days_until: number;
  href: string;
}

export interface IAccountOffice {
  office_key: string;
  display_name?: string | null;
  start_date: string;
  end_date?: string | null;
  is_current: boolean;
}

export interface IAccountPayment {
  id: number;
  paid_at: string;
  amount: number | string;
  memo?: string | null;
}

export interface IAccountInstalment {
  label?: string;
  seq?: number;
  due_date?: string | null;
  amount: number;
  // Cumulative: payments are one pool with no per-instalment allocation, so
  // this means "paid up through this date", not "this one was paid".
  covered: boolean;
}

export interface IAccountMoney {
  year: number;
  category?: string;
  session_label?: string;
  rooms?: string[];
  total_owed: number;
  total_paid: number;
  due_to_date: number;
  balance_total: number;
  balance_due_to_date: number;
  is_behind: boolean;
  instalments: IAccountInstalment[];
  payments: IAccountPayment[];
  deposit?: { status: string; amount: number | string; received_at?: string | null } | null;
}

export interface IAccountSummary {
  as_of: string;
  year: number;
  brother: {
    id: number;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    pledge_class?: string | null;
    graduation?: number | null;
    status: string;
  } | null;
  offices: IAccountOffice[];
  dues: IAccountMoney | null;
  residence: IAccountMoney | null;
  makeups: { total: number; workday: any[]; shift: any[]; party: any[] } | null;
  room_draw: { total: number; breakdown?: Record<string, number> } | null;
  upcoming: IAccountUpcoming[];
  message?: string;
}

export async function getAccountSummary(year?: number): Promise<IAccountSummary> {
  const res = await apiClient.get("/me/account", { params: year ? { year } : {} });
  return res.data;
}
