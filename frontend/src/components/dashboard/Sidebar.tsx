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
  Search
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Sidebar = () => {
  const pathname = usePathname();
  const locale = useLocale();

  const menuItems = [
    { name: 'Overview', href: `/${locale}/dashboard/admin`, icon: LayoutDashboard },
    { name: 'Properties', href: `/${locale}/dashboard/admin/properties`, icon: Home },
    { name: 'Leads', href: `/${locale}/dashboard/admin/leads`, icon: MessageSquare },
    { name: 'Users', href: `/${locale}/dashboard/admin/users`, icon: Users },
    { name: 'AI Config', href: `/${locale}/dashboard/admin/ai-config`, icon: TrendingUp },
    { name: 'Settings', href: `/${locale}/dashboard/admin/settings`, icon: Settings },
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

      <nav className="flex-grow p-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
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
        <button className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-400 hover:text-red-500 transition-colors font-medium">
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
