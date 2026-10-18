'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Menu, X, Globe, User, LogOut, LayoutDashboard, Building2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { crmHome, useAuth } from '@/lib/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Navbar = () => {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  // Signed-in clients go to their portal, staff to the CRM.
  const accountHref = user ? (user.app === 'crm' ? crmHome() : `/${locale}/dashboard`) : `/${locale}/login`;
  const accountLabel = user ? (locale === 'ar' ? 'حسابي' : 'My account') : t('login');
  const [signingOut, setSigningOut] = useState(false);

  const isHomePage = pathname === `/${locale}` || pathname === `/${locale}/`;
  const shouldShowSolidNav = isScrolled || !isHomePage;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isUserMenuOpen]);

  const toggleLanguage = () => {
    const nextLocale = locale === 'en' ? 'ar' : 'en';
    const newPathname = pathname.replace(`/${locale}`, `/${nextLocale}`);
    router.push(newPathname);
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    setSigningOut(true);
    router.push(`/${locale}`);
    await logout();
    setSigningOut(false);
  };

  const navLinks = [
    { name: t('home'), href: `/${locale}` },
    { name: t('properties'), href: `/${locale}/properties` },
    { name: t('about'), href: `/${locale}/about` },
    { name: t('contact'), href: `/${locale}/contact` },
  ];

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      shouldShowSolidNav ? "bg-white shadow-md py-4" : "bg-transparent py-6"
    )}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <div className="relative h-12 w-40">
              <Image 
                src="/logo.png" 
                alt="ELITE Real Estate" 
                fill
                sizes="160px"
                className={cn(
                  "object-contain transition-all duration-300",
                  !shouldShowSolidNav && "brightness-0 invert"
                )} 
                priority
              />
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href}
                className={cn(
                  "font-medium transition-colors hover:text-[#b98f42]",
                  shouldShowSolidNav ? "text-gray-700" : "text-white"
                )}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="hidden lg:flex items-center gap-6">
            <button 
              onClick={toggleLanguage}
              className={cn(
                "flex items-center gap-2 font-bold transition-colors hover:text-[#b98f42]",
                shouldShowSolidNav ? "text-gray-900" : "text-white"
              )}
            >
              <Globe className="w-5 h-5" />
              {locale === 'en' ? 'عربي' : 'EN'}
            </button>

            {/* Signed-in user: show dropdown with My account + Sign out */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  className={cn(
                    "flex items-center gap-2 font-bold transition-colors hover:text-[#b98f42]",
                    shouldShowSolidNav ? "text-gray-900" : "text-white"
                  )}
                >
                  <User className="w-5 h-5" />
                  {accountLabel}
                  <svg className={cn("w-4 h-4 transition-transform", isUserMenuOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isUserMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      <p className="text-[11px] text-[#b98f42] font-semibold uppercase tracking-wider mt-1">
                        {user.app === 'crm' ? (locale === 'ar' ? 'فريق العمل' : 'Staff') : (locale === 'ar' ? 'عميل' : 'Client')}
                      </p>
                    </div>
                    <Link
                      role="menuitem"
                      href={accountHref}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 hover:text-[#b98f42] transition-colors"
                    >
                      {user.app === 'crm' ? <Building2 className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                      {locale === 'ar' ? 'فتح لوحة التحكم' : (user.app === 'crm' ? 'Open CRM' : 'Open dashboard')}
                    </Link>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={handleLogout}
                      disabled={signingOut}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                    >
                      <LogOut className="w-4 h-4" />
                      {locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                href={accountHref}
                className={cn(
                  "flex items-center gap-2 font-bold transition-colors hover:text-[#b98f42]",
                  shouldShowSolidNav ? "text-gray-900" : "text-white"
                )}
              >
                <User className="w-5 h-5" />
                {accountLabel}
              </Link>
            )}

            <Link 
              href={`/${locale}/contact`}
              className="bg-[#b98f42] text-white px-6 py-2 rounded font-bold hover:bg-black transition-colors"
            >
              {t('send_inquiry')}
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="lg:hidden flex items-center gap-4">
            <button 
              onClick={toggleLanguage}
              className={cn(
                "p-2 rounded-full",
                shouldShowSolidNav ? "text-black" : "text-white"
              )}
            >
              <Globe className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                "p-2 rounded-full",
                shouldShowSolidNav ? "text-black" : "text-white"
              )}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white shadow-xl p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-lg font-bold text-gray-900 py-2 border-b border-gray-100"
              >
                {link.name}
              </Link>
            ))}
            {user ? (
              <>
                <div className="py-2 px-2 border-b border-gray-100">
                  <p className="text-base font-bold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <Link 
                  href={accountHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-bold text-gray-900 py-2 border-b border-gray-100 flex items-center gap-2"
                >
                  {user.app === 'crm' ? <Building2 className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
                  {locale === 'ar' ? 'لوحة التحكم' : (user.app === 'crm' ? 'CRM Dashboard' : 'My dashboard')}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="text-lg font-bold text-red-600 py-2 border-b border-gray-100 flex items-center gap-2 text-left disabled:opacity-60"
                >
                  <LogOut className="w-5 h-5" />
                  {locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                </button>
              </>
            ) : (
              <Link 
                href={accountHref}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-lg font-bold text-gray-900 py-2 border-b border-gray-100 flex items-center gap-2"
              >
                <User className="w-5 h-5" />
                {accountLabel}
              </Link>
            )}
            <Link 
              href={`/${locale}/contact`}
              onClick={() => setIsMobileMenuOpen(false)}
              className="bg-[#b98f42] text-white py-3 rounded text-center font-bold mt-2"
            >
              {t('send_inquiry')}
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
