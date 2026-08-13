import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getMe, devLogin as apiDevLogin, logout as apiLogout, registerUnauthorizedHandler, unregisterUnauthorizedHandler } from '../api';
import type { AuthUser } from '../types';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  /** Dev-only bypass; the backend 404s this in production. */
  devLogin: () => Promise<string | undefined>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  devLogin: async () => undefined,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = () => setUser(null);
    registerUnauthorizedHandler(handler);
    return () => unregisterUnauthorizedHandler(handler);
  }, []);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const devLogin = useCallback(async () => {
    try {
      setUser(await apiDevLogin());
      return undefined;
    } catch (err: any) {
      return err?.response?.data?.error || 'Dev login is not available.';
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, devLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
