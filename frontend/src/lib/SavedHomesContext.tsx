'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

/**
 * Saved homes for signed-in clients. The list lives in the CRM (the client's shortlist), so the
 * agent sees it too; this context only mirrors it for the hearts on cards and listing pages.
 */
interface SavedHomesContextType {
  isSaved: (ref: string) => boolean;
  toggle: (ref: string) => Promise<void>;
  ready: boolean;
}

const SavedHomesContext = createContext<SavedHomesContextType | undefined>(undefined);

export function SavedHomesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const isClient = user?.app === 'portal';

  useEffect(() => {
    if (!isClient) return;
    const controller = new AbortController();
    api
      .get<{ property: { _id: string } }[]>('/portal/saved', controller.signal)
      .then((rows) => setSaved(new Set(rows.map((r) => r.property._id))))
      .catch(() => undefined)
      .finally(() => setReady(true));
    return () => controller.abort();
  }, [isClient]);

  const toggle = useCallback(
    async (ref: string) => {
      if (!isClient) {
        router.push(`/${locale}/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const was = saved.has(ref);
      setSaved((s) => {
        const next = new Set(s);
        if (was) next.delete(ref);
        else next.add(ref);
        return next;
      });
      try {
        if (was) await api.del(`/portal/saved/${encodeURIComponent(ref)}`);
        else await api.post('/portal/saved', { property: ref });
      } catch {
        // Roll back on failure.
        setSaved((s) => {
          const next = new Set(s);
          if (was) next.add(ref);
          else next.delete(ref);
          return next;
        });
      }
    },
    [isClient, locale, pathname, router, saved],
  );

  return <SavedHomesContext.Provider value={{ isSaved: (ref) => saved.has(ref), toggle, ready: ready || !isClient }}>{children}</SavedHomesContext.Provider>;
}

export function useSavedHomes() {
  const ctx = useContext(SavedHomesContext);
  if (!ctx) throw new Error('useSavedHomes must be used within SavedHomesProvider');
  return ctx;
}
