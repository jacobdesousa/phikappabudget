import { apiClient } from "./apiClient";

export type EmailStatus = "pending" | "sent" | "failed" | "dev";

export interface IEmailLogRow {
  id: number;
  created_at: string;
  sent_at?: string | null;
  kind: string;
  to_email: string;
  subject: string;
  status: EmailStatus;
  provider_message_id?: string | null;
  error?: string | null;
  attachments?: string | null;
  dedupe_key?: string | null;
  brother_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
}

// The body only comes back one row at a time — it is the largest column and
// the list never needs it.
export interface IEmailLogEntry extends IEmailLogRow {
  body_text?: string | null;
  user_id?: number | null;
  actor_user_id?: number | null;
  user_email?: string | null;
  actor_email?: string | null;
}

export interface IEmailLogPage {
  rows: IEmailLogRow[];
  next_cursor: number | null;
  counts: Partial<Record<EmailStatus, number>>;
}

export interface EmailLogFilters {
  kind?: string;
  status?: EmailStatus;
  from?: string;
  to?: string;
  q?: string;
  cursor?: number | null;
  limit?: number;
}

export async function getEmailLog(filters: EmailLogFilters = {}): Promise<IEmailLogPage> {
  const params: Record<string, string | number> = {};
  if (filters.kind) params.kind = filters.kind;
  if (filters.status) params.status = filters.status;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.q) params.q = filters.q;
  if (filters.cursor) params.cursor = filters.cursor;
  if (filters.limit) params.limit = filters.limit;

  const res = await apiClient.get("/admin/email-log", { params });
  return res.data;
}

export async function getEmailLogEntry(id: number): Promise<IEmailLogEntry> {
  const res = await apiClient.get(`/admin/email-log/${id}`);
  return res.data;
}
