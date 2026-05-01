import * as React from "react";
import { me as fetchMe, type AuthUser } from "../services/authService";
import { getAccessToken } from "../services/apiClient";

type AuthState = {
  loading: boolean;
  user: AuthUser | null;
  permissions: string[];
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
};

const AuthContext = React.createContext<AuthState | undefined>(undefined);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider(props: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [permissions, setPermissions] = React.useState<string[]>([]);

  const refresh = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setPermissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const u = await fetchMe();
      setUser(u);
      setPermissions(u.permissions ?? []);
    } catch {
      // apiClient interceptor will redirect on 401 if session is invalid; treat as logged out here.
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const can = React.useCallback(
    (permission: string) => {
      return permissions.includes(permission);
    },
    [permissions]
  );

  const canAny = React.useCallback(
    (keys: string[]) => {
      if (!keys || keys.length === 0) return true;
      const set = new Set(permissions);
      return keys.some((k) => set.has(k));
    },
    [permissions]
  );

  const value = React.useMemo<AuthState>(
    () => ({ loading, user, permissions, refresh, can, canAny }),
    [loading, user, permissions, refresh, can, canAny]
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}


