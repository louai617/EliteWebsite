'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Activity, BarChart3, Building2, CheckSquare, FileDown, LayoutDashboard, LogOut, MessageSquare, UserCircle } from 'lucide-react';
import { crmHome, useAuth } from '@/lib/AuthContext';
import { cn, Loading } from './ui';

const NAV = [
  { href: '', label: 'Overview', icon: LayoutDashboard },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/leads', label: 'Enquiries', icon: MessageSquare },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/documents', label: 'My data', icon: FileDown },
  { href: '/account', label: 'Account', icon: UserCircle },
];

/**
 * Client portal frame. Navigation guard only — the backend scopes every request to the
 * signed-in client and rejects anyone else, whatever this component renders.
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${locale}/dashboard`;
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !user && !signingOut) router.replace(`/${locale}/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, locale, pathname, signingOut]);

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-gray-50 pt-28">
        <Loading />
      </main>
    );
  }

  if (user.app === 'crm') {
    return (
      <main className="min-h-screen bg-gray-50 pt-32 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl border border-gray-100 shadow-xl p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900">You are signed in as staff</h1>
          <p className="text-gray-500 text-sm mt-2">The client portal is for client accounts. Staff work in the CRM.</p>
          <a href={crmHome()} className="mt-6 inline-block bg-[#1a1a1a] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#b98f42] transition-colors">
            Open the CRM
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-28 pb-16">
      <div className="container mx-auto px-4 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 self-start">
          <div className="bg-[#1a1a1a] text-white rounded-2xl p-4">
            <div className="px-2 pb-4 mb-2 border-b border-white/10">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">Client portal</p>
              <p className="font-bold mt-1 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto" aria-label="Client portal">
              {NAV.map((item) => {
                const href = `${base}${item.href}`;
                const active = item.href ? pathname.startsWith(href) : pathname === base;
                return (
                  <Link
                    key={item.label}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', active ? 'bg-[#b98f42] text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white')}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={async () => {
                setSigningOut(true);
                router.push(`/${locale}`);
                await logout();
              }}
              className="mt-2 flex items-center gap-3 px-3 py-2.5 w-full text-left text-sm text-gray-400 hover:text-red-400 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
