'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Menu, X, Globe, Phone, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Navbar = () => {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isHomePage = pathname === `/${locale}` || pathname === `/${locale}/`;
  const shouldShowSolidNav = isScrolled || !isHomePage;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLanguage = () => {
    const nextLocale = locale === 'en' ? 'ar' : 'en';
    const newPathname = pathname.replace(`/${locale}`, `/${nextLocale}`);
    router.push(newPathname);
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
            <Link 
              href={`/${locale}/login`}
              className={cn(
                "flex items-center gap-2 font-bold transition-colors hover:text-[#b98f42]",
                shouldShowSolidNav ? "text-gray-900" : "text-white"
              )}
            >
              <User className="w-5 h-5" />
              {t('login')}
            </Link>
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
            <Link 
              href={`/${locale}/login`}
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-lg font-bold text-gray-900 py-2 border-b border-gray-100 flex items-center gap-2"
            >
              <User className="w-5 h-5" />
              {t('login')}
            </Link>
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
