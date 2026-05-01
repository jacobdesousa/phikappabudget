import { apiClient, parseApiError, setAccessToken } from "./apiClient";

export type AuthUser = {
  id: number;
  email: string;
  roles?: string[];
  permissions?: string[];
};

export type InviteListItem = {
  id: number;
  email: string;
  brother_id?: number | null;
  expires_at?: string | Date | null;
  used_at?: string | Date | null;
  revoked_at?: string | Date | null;
  created_at?: string | Date | null;
  created_by_user_id?: number | null;
  created_by_email?: string | null;
  brother_first_name?: string | null;
  brother_last_name?: string | null;
  brother_office?: string | null;
  brother_status?: string | null;
};

export type SessionRow = {
  id: number;
  created_at?: string | Date | null;
  expires_at?: string | Date | null;
  revoked_at?: string | Date | null;
  user_agent?: string | null;
  ip?: string | null;
  is_current?: boolean;
};

export type SessionsResponse = {
  current_session_id?: number | null;
  sessions: SessionRow[];
};

export type AdminUserRow = {
  id: number;
  email: string;
  status?: string | null;
  brother_id?: number | null;
  last_login_at?: string | Date | null;
  created_at?: string | Date | null;
  brother_first_name?: string | null;
  brother_last_name?: string | null;
  brother_office?: string | null;
  brother_status?: string | null;
  roles?: string[];
  permissions?: string[];
  overrides_count?: number;
};

export type PermissionOverrideRow = {
  user_id: number;
  permission_key: string;
  effect: "allow" | "deny";
  created_by_user_id?: number | null;
  created_at?: string | Date | null;
};

export async function login(email: string, password: string): Promise<{ ok: true; user: AuthUser } | { ok: false; status: number; error: string }> {
  try {
    const res = await apiClient.post("/auth/login", { email, password });
    const token = res.data?.access_token ?? null;
    setAccessToken(token);
    return { ok: true, user: res.data?.user };
  } catch (e) {
    const err = parseApiError(e);
    if (err.status === 401) {
      return { ok: false, status: err.status, error: "Invalid email or password." };
    }
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    setAccessToken(null);
  }
}

export async function me(): Promise<AuthUser> {
  const res = await apiClient.get("/auth/me");
  return res.data;
}

export async function acceptInvite(token: string, password: string): Promise<{ ok: true; user: AuthUser } | { ok: false; status: number; error: string }> {
  try {
    const res = await apiClient.post("/auth/accept-invite", { token, password });
    const access = res.data?.access_token ?? null;
    setAccessToken(access);
    return { ok: true, user: res.data?.user };
  } catch (e) {
    const err = parseApiError(e);
    if (err.status === 401) {
      return { ok: false, status: err.status, error: "Invite is not valid or has expired." };
    }
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function inviteUser(payload: { brother_id: number }): Promise<{ ok: true; invite_url?: string } | { ok: false; status: number; error: string }> {
  try {
    const res = await apiClient.post("/auth/invite", payload);
    return { ok: true, invite_url: res.data?.invite_url };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function getInvites(): Promise<InviteListItem[]> {
  const res = await apiClient.get("/auth/invites");
  return res.data;
}

export async function revokeInvite(id: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.post(`/auth/invites/${id}/revoke`);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function reissueInvite(id: number): Promise<{ ok: true; invite_url?: string } | { ok: false; status: number; error: string }> {
  try {
    const res = await apiClient.post(`/auth/invites/${id}/reissue`);
    return { ok: true, invite_url: res.data?.invite_url };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function getSessions(): Promise<SessionsResponse> {
  const res = await apiClient.get("/auth/sessions");
  return res.data;
}

export async function revokeSession(id: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.post(`/auth/sessions/${id}/revoke`);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function revokeAllSessions(payload?: { keep_current?: boolean }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.post(`/auth/sessions/revoke-all`, payload ?? {});
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const res = await apiClient.get("/auth/admin/users");
  return res.data;
}

export async function adminUpdateUserStatus(userId: number, status: "active" | "disabled"): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.put(`/auth/admin/users/${userId}`, { status });
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function adminListOverrides(userId: number): Promise<PermissionOverrideRow[]> {
  const res = await apiClient.get(`/auth/admin/users/${userId}/overrides`);
  return res.data;
}

export async function adminUpsertOverride(userId: number, payload: { permission_key: string; effect: "allow" | "deny" }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.put(`/auth/admin/users/${userId}/overrides`, payload);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function adminDeleteOverride(userId: number, permissionKey: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.delete(`/auth/admin/users/${userId}/overrides/${encodeURIComponent(permissionKey)}`);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export type RolePermissionsResponse = {
  permission_keys: string[];
  offices: Array<{ office_key: string; display_name: string }>;
  role_permissions: Array<{ role_key: string; display_name?: string; permissions: string[] }>;
};

export async function adminGetRolePermissions(): Promise<RolePermissionsResponse> {
  const res = await apiClient.get("/auth/admin/roles");
  return res.data;
}

export async function adminUpdateRolePermissions(roleKey: string, permissions: string[]): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.put(`/auth/admin/roles/${encodeURIComponent(roleKey)}`, { permissions });
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export type OfficeRow = {
  office_key: string;
  display_name: string;
  created_at?: string | Date | null;
};

export async function adminGetOffices(): Promise<OfficeRow[]> {
  const res = await apiClient.get("/auth/admin/offices");
  return res.data;
}

export async function adminCreateOffice(payload: { office_key: string; display_name?: string }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.post("/auth/admin/offices", payload);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}

export async function adminDeleteOffice(officeKey: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    await apiClient.delete(`/auth/admin/offices/${encodeURIComponent(officeKey)}`);
    return { ok: true };
  } catch (e) {
    const err = parseApiError(e);
    return { ok: false, status: err.status, error: err.message };
  }
}


