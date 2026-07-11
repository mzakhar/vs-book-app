import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getMe, login as apiLogin, logout as apiLogout, registerUnauthorizedHandler, unregisterUnauthorizedHandler } from '../api';
import type { AuthUser } from '../types';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => undefined,
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

  const login = useCallback(async (username: string, password: string) => {
    try {
      const u = await apiLogin(username, password);
      setUser(u);
      return undefined;
    } catch (err: any) {
      if (err?.response?.status === 429) return 'Too many attempts, try later.';
      return err?.response?.data?.error || 'Invalid username or password';
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
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
