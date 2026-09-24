'use client';

import { create } from 'zustand';
import api, { onUnauthorized } from '@/lib/api';
import { STAFF_ROLES } from '@/lib/shared/constants';
import type { Permission } from '@/lib/shared/permissions';
import type { SessionUser } from '@/lib/shared/types';

interface Credentials {
  email: string;
  password: string;
}

interface RegisterData extends Credentials {
  full_name: string;
  phone?: string;
}

interface AuthState {
  user: SessionUser | null;
  /** `idle` until the first /auth/me check finishes. */
  status: 'idle' | 'loading' | 'ready';
  fetchMe: () => Promise<SessionUser | null>;
  login: (credentials: Credentials) => Promise<SessionUser>;
  register: (data: RegisterData) => Promise<SessionUser>;
  logout: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
  can: (permission: Permission) => boolean;
  isStaff: () => boolean;
}

/**
 * Who is signed in. The session itself is an httpOnly cookie; this store only
 * mirrors the non-secret user profile for rendering. It is never trusted for
 * authorisation — the API re-checks every request.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',

  fetchMe: async () => {
    if (get().status === 'loading') return get().user;
    set({ status: 'loading' });
    try {
      const { data } = await api.get<{ data: { user: SessionUser | null } }>('/auth/me');
      set({ user: data.data.user, status: 'ready' });
      return data.data.user;
    } catch {
      set({ user: null, status: 'ready' });
      return null;
    }
  },

  login: async (credentials) => {
    const { data } = await api.post<{ data: { user: SessionUser } }>('/auth/login', credentials);
    set({ user: data.data.user, status: 'ready' });
    return data.data.user;
  },

  register: async (payload) => {
    const { data } = await api.post<{ data: { user: SessionUser } }>('/auth/register', payload);
    set({ user: data.data.user, status: 'ready' });
    return data.data.user;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      set({ user: null, status: 'ready' });
    }
  },

  setUser: (user) => set({ user }),

  can: (permission) => Boolean(get().user?.permissions.includes(permission)),

  isStaff: () => {
    const role = get().user?.role;
    return Boolean(role && STAFF_ROLES.includes(role));
  },
}));

// A 401 from any CRM call means the session is gone — drop the cached profile.
if (typeof window !== 'undefined') {
  onUnauthorized(() => useAuthStore.setState({ user: null, status: 'ready' }));
}

/** Where to send a user after signing in. `next` must be a same-site path. */
export function postLoginPath(user: SessionUser, locale: string, next?: string | null): string {
  if (next && next.startsWith(`/${locale}/`) && !next.startsWith('//') && !next.includes('://')) {
    const wantsDashboard = next.startsWith(`/${locale}/dashboard`);
    if (!wantsDashboard || STAFF_ROLES.includes(user.role)) return next;
  }
  return STAFF_ROLES.includes(user.role) ? `/${locale}/dashboard` : `/${locale}/account`;
}
