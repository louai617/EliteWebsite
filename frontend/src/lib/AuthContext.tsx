'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/store/authStore';

/**
 * Loads the signed-in user once on mount. Auth state itself lives in the
 * Zustand store (`@/store/authStore`); this component and `useAuth()` keep the
 * API the existing pages already use.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);
  return <>{children}</>;
}

export const useAuth = () => {
  const router = useRouter();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const storeLogout = useAuthStore((s) => s.logout);

  const logout = async () => {
    await storeLogout();
    router.push(`/${locale}`);
    router.refresh();
  };

  return { user, loading: status !== 'ready', login, register, logout };
};
