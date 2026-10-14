'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, CRM_URL } from '@/lib/api';
import type { AuthUser } from '@/lib/api-types';

/**
 * Session state for the website and client portal. The session itself is an httpOnly
 * cookie owned by the backend; this context only mirrors `GET /auth/me`. Roles shown here
 * are for display/navigation — every permission is enforced again by the backend.
 */

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Staff accounts use the CRM, not the client portal. */
export function crmHome() {
  return `${CRM_URL}/`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(
    (signal?: AbortSignal) =>
      api
        .get<{ user: AuthUser }>('/auth/me', signal)
        .then(({ user }) => setUser(user))
        .catch((error) => {
          if (signal?.aborted) return;
          // 401 = signed out; anything else (network) also leaves the visitor signed out.
          if (!(error instanceof ApiError) || error.status !== 401) console.warn('Session check failed', error);
          setUser(null);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadSession(controller.signal);
    return () => controller.abort();
  }, [loadSession]);

  const refresh = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    const { user } = await api.post<{ user: AuthUser }>('/auth/login', credentials);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user } = await api.post<{ user: AuthUser }>('/auth/register', input);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
