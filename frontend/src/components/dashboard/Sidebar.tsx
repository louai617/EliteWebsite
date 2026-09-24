'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  LayoutDashboard,
  Home,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  TrendingUp,
  Contact,
  CalendarDays,
  Handshake,
  ListChecks,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/lib/AuthContext';
import { useAuthStore } from '@/store/authStore';
import type { Permission } from '@/lib/shared/permissions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Sidebar = () => {
  const pathname = usePathname();
  const locale = useLocale();
  const { logout } = useAuth();
  const can = useAuthStore((s) => s.can);
  // Re-render when the user (and so their permissions) changes.
  useAuthStore((s) => s.user);

  const base = `/${locale}/dashboard`;
  const menuItems: { name: string; href: string; icon: React.ComponentType<{ className?: string }>; permission?: Permission }[] = [
    { name: 'Overview', href: base, icon: LayoutDashboard },
    { name: 'Leads', href: `${base}/leads`, icon: MessageSquare, permission: 'leads.read' },
    { name: 'Clients', href: `${base}/clients`, icon: Contact, permission: 'clients.read' },
    { name: 'Properties', href: `${base}/properties`, icon: Home, permission: 'properties.read' },
    { name: 'Viewings', href: `${base}/viewings`, icon: CalendarDays, permission: 'viewings.read' },
    { name: 'Deals', href: `${base}/deals`, icon: Handshake, permission: 'deals.read' },
    { name: 'Tasks', href: `${base}/tasks`, icon: ListChecks, permission: 'tasks.read' },
    { name: 'Users', href: `${base}/users`, icon: Users, permission: 'users.read_all' },
    { name: 'AI Config', href: `${base}/ai-config`, icon: TrendingUp, permission: 'settings.update' },
    { name: 'Settings', href: `${base}/settings`, icon: Settings, permission: 'settings.update' },
  ];

  return (
    <aside className="w-64 bg-[#1a1a1a] text-white min-h-screen fixed left-0 top-0 hidden lg:flex flex-col">
      <div className="p-6 border-b border-white/10">
        <Link href={`/${locale}`} className="inline-block relative h-10 w-32">
          <Image
            src="/logo.png"
            alt="ELITE Real Estate"
            fill
            sizes="128px"
            className="object-contain brightness-0 invert"
          />
        </Link>
      </div>

      <nav className="flex-grow p-4 space-y-2 mt-4 overflow-y-auto">
        {menuItems
          .filter((item) => !item.permission || can(item.permission))
          .map((item) => {
            const isActive = item.href === base ? pathname === base : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                  isActive ? "bg-[#b98f42] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-400 hover:text-red-500 transition-colors font-medium"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
