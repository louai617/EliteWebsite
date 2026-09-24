'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Bell, Loader2, Search } from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import api from '@/lib/api';
import { ROLE_LABELS } from '@/lib/shared/constants';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/crmStores';

/**
 * Dashboard chrome (sidebar + top bar) and the client-side session gate.
 * The proxy already blocks signed-out visitors; this handles sessions that
 * expire or are revoked while the dashboard is open.
 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const isStaff = useAuthStore((s) => s.isStaff);
  const loadSettings = useSettingsStore((s) => s.load);
  const [search, setSearch] = useState('');
  const [overdue, setOverdue] = useState(0);

  const allowed = Boolean(user && isStaff());

  useEffect(() => {
    if (status !== 'ready') return;
    if (!user) {
      router.replace(`/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`);
    } else if (!isStaff()) {
      router.replace(`/${locale}/account`);
    }
  }, [status, user, isStaff, router, locale]);

  useEffect(() => {
    if (!allowed) return;
    void loadSettings();
    api
      .get<{ meta: { total: number } }>('/tasks', { params: { overdue: true, assigned_agent: 'me', limit: 1 } })
      .then(({ data }) => setOverdue(data.meta.total))
      .catch(() => setOverdue(0));
  }, [allowed, loadSettings]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#b98f42]" />
      </div>
    );
  }

  const initial = user!.full_name.trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-grow lg:ml-64 flex flex-col min-w-0">
        {/* Top Navigation */}
        <header className="bg-white h-16 border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const q = search.trim();
              router.push(`/${locale}/dashboard/leads${q ? `?q=${encodeURIComponent(q)}` : ''}`);
            }}
            className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 w-96 max-w-full"
          >
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="search"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search leads by name, phone, email..."
              className="bg-transparent border-none outline-none text-sm text-gray-700 w-full"
            />
          </form>

          <div className="flex items-center gap-6">
            <Link
              href={`/${locale}/dashboard/tasks`}
              title={overdue ? `${overdue} overdue task${overdue === 1 ? '' : 's'}` : 'Tasks'}
              className="relative p-2 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <Bell className="w-6 h-6" />
              {overdue > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </Link>
            <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900 leading-none mb-1">{user!.full_name}</p>
                <p className="text-xs text-gray-500 font-medium leading-none">{ROLE_LABELS[user!.role]}</p>
              </div>
              <div className="w-10 h-10 bg-[#b98f42] rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-white shadow-sm">
                {initial}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
