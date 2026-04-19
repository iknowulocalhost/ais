'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  apiFetch,
  clearTokens,
  getAccessToken,
  setAuthFailureHandler,
  setTokens,
} from './api';
import type { AuthUser, LoginResponse, Role } from './types';
import { hasAnyRole, homePathForRoles } from './types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasRole: (required: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Восстановление сессии по перезагрузке: если access есть в localStorage,
 * тянем /auth/me. 401 → refresh попробует сам (через apiFetch), если и он упал —
 * onAuthFailure выкинет на /login.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      router.replace('/login');
    });
    return () => setAuthFailureHandler(null);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await apiFetch<AuthUser>('/api/users/me');
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const resp = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
    setTokens(resp.accessToken, resp.refreshToken);
    setUser(resp.user);
    return resp.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* даже если сервер недоступен — локально всё равно вычищаем */
    }
    clearTokens();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      logout,
      hasRole: (required) => hasAnyRole(user, required),
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен быть внутри <AuthProvider>');
  return ctx;
}

export function useHomePath(): string {
  const { user } = useAuth();
  return user ? homePathForRoles(user.roles) : '/login';
}
