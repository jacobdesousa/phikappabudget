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

function redirectToLogin(reason: "expired" | "unauthorized" = "unauthorized") {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login?reason=${encodeURIComponent(reason)}&next=${encodeURIComponent(next)}`);
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
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

    if (status === 401 && original && !original._retry) {
      original._retry = true;
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
      redirectToLogin(getAccessToken() ? "expired" : "unauthorized");
    }

    return Promise.reject(error);
  }
);



