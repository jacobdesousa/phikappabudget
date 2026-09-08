import axios, { AxiosError } from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export const API_BASE_URL = baseURL;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export type ApiValidationIssue = {
  path?: Array<string | number>;
  message: string;
  code?: string;
};

export type ApiErrorPayload = {
  message?: string;
  issues?: ApiValidationIssue[];
};

export type ApiError = {
  status: number;
  message: string;
  issues?: ApiValidationIssue[];
};

export function parseApiError(err: unknown): ApiError {
  if (err && typeof err === "object" && (err as AxiosError).isAxiosError) {
    const axiosErr = err as AxiosError<any>;
    const status = axiosErr.response?.status ?? 0;
    const payload: ApiErrorPayload | undefined = axiosErr.response?.data?.error;
    return {
      status,
      message: payload?.message ?? axiosErr.message ?? "Request failed",
      issues: payload?.issues,
    };
  }

  return {
    status: 0,
    message: "Request failed",
  };
}

const ACCESS_TOKEN_KEY = "pks_access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  else window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

// A "view as" session lives in sessionStorage, not localStorage: it belongs to
// this tab, ends with it, and never outlives the browser session. The admin's
// own token stays untouched in localStorage the whole time, so leaving the
// session is instant and needs no round trip.
const VIEW_AS_TOKEN_KEY = "pks_view_as_token";
const VIEW_AS_USER_KEY = "pks_view_as_user";

export type ViewAsUser = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

export function getViewAsToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(VIEW_AS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getViewAsUser(): ViewAsUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(VIEW_AS_USER_KEY);
    return raw ? (JSON.parse(raw) as ViewAsUser) : null;
  } catch {
    return null;
  }
}

export function setViewAs(token: string | null, user: ViewAsUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (!token || !user) {
      window.sessionStorage.removeItem(VIEW_AS_TOKEN_KEY);
      window.sessionStorage.removeItem(VIEW_AS_USER_KEY);
      return;
    }
    window.sessionStorage.setItem(VIEW_AS_TOKEN_KEY, token);
    window.sessionStorage.setItem(VIEW_AS_USER_KEY, JSON.stringify(user));
  } catch {
    // Private browsing with storage disabled: the session simply won't persist.
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await apiClient.post("/auth/refresh");
    const token = res.data?.access_token ?? null;
    setAccessToken(token);
    return token;
  } catch {
    setAccessToken(null);
    return null;
  }
}

let redirecting = false;

export function redirectToLogin(reason: "expired" | "unauthorized" = "unauthorized") {
  if (typeof window === "undefined") return;
  if (redirecting) return;
  if (window.location.pathname === "/login") return;
  redirecting = true;
  setAccessToken(null);
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login?reason=${encodeURIComponent(reason)}&next=${encodeURIComponent(next)}`);
}

apiClient.interceptors.request.use((config) => {
  // While viewing as someone, every request goes out as them — otherwise the
  // page would show one identity and act as another.
  const token = getViewAsToken() ?? getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;
    const url = String(original?.url ?? "");

    // Auth endpoints handle their own 401 UX (e.g. invalid credentials).
    // Do NOT attempt refresh/redirect for these.
    if (status === 401 && (url.startsWith("/auth/login") || url.startsWith("/auth/accept-invite"))) {
      return Promise.reject(error);
    }

    // The refresh/logout calls must never re-enter the refresh flow: doing so would
    // await the very request whose handler is running, and hang forever.
    if (url.startsWith("/auth/refresh") || url.startsWith("/auth/logout")) {
      return Promise.reject(error);
    }

    // A view-as token cannot be refreshed — the refresh cookie belongs to the
    // admin, so refreshing would quietly hand the page back to them while the
    // banner still claimed otherwise. Expiring ends the session instead.
    if (status === 401 && getViewAsToken()) {
      setViewAs(null, null);
      if (typeof window !== "undefined") window.location.reload();
      return Promise.reject(error);
    }

    if (status === 401 && original && !original._retry) {
      original._retry = true;
      const hadToken = Boolean(getAccessToken());
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const token = await refreshPromise.finally(() => {
        refreshPromise = null;
      });
      if (token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient.request(original);
      }

      // Refresh failed => session expired or not signed in.
      redirectToLogin(hadToken ? "expired" : "unauthorized");
    }

    return Promise.reject(error);
  }
);



