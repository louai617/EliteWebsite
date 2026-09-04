import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Globe, Phone, MapPin, Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import { company, pick } from '@/data/company';

const Footer = () => {
  const t = useTranslations('common');
  const locale = useLocale();

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#1a1a1a] text-white pt-20 pb-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Company Info */}
          <div className="space-y-6">
            <Link href={`/${locale}`} className="inline-block relative h-12 w-40">
              <Image 
                src="/logo.png" 
                alt="ELITE Real Estate" 
                fill
                sizes="160px"
                className="object-contain brightness-0 invert"
              />
            </Link>
            <p className="text-gray-400 font-light leading-relaxed">
              {pick(company.about[1], locale)}
            </p>
            <div className="flex items-center gap-4 pt-4">
              <a href="#" className="text-white hover:text-[#b98f42] transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-white hover:text-[#b98f42] transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-white hover:text-[#b98f42] transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-white hover:text-[#b98f42] transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-8 uppercase tracking-wider text-[#b98f42]">Quick Links</h3>
            <ul className="space-y-4">
              <li>
                <Link href={`/${locale}`} className="text-gray-400 hover:text-white transition-colors">
                  {t('home')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/properties`} className="text-gray-400 hover:text-white transition-colors">
                  {t('properties')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/about`} className="text-gray-400 hover:text-white transition-colors">
                  {t('about')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/contact`} className="text-gray-400 hover:text-white transition-colors">
                  {t('contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Property Types */}
          <div>
            <h3 className="text-lg font-bold mb-8 uppercase tracking-wider text-[#b98f42]">Property Types</h3>
            <ul className="space-y-4">
              <li>
                <Link href={`/${locale}/properties?type=apartment`} className="text-gray-400 hover:text-white transition-colors">
                  Apartments
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/properties?type=villa`} className="text-gray-400 hover:text-white transition-colors">
                  Villas
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/properties?type=penthouse`} className="text-gray-400 hover:text-white transition-colors">
                  Penthouses
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/properties?type=commercial`} className="text-gray-400 hover:text-white transition-colors">
                  Commercial
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-bold mb-8 uppercase tracking-wider text-[#b98f42]">Contact Us</h3>
            <ul className="space-y-4 text-gray-400">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#b98f42] mt-1 shrink-0" />
                <span>{pick(company.contact.address, locale)}</span>
              </li>
              {company.contact.phones.map((phone, index) => (
                <li key={phone} className="flex items-center gap-3">
                  <Phone
                    className={`w-5 h-5 text-[#b98f42] shrink-0 ${index > 0 ? 'invisible' : ''}`}
                    aria-hidden={index > 0}
                  />
                  <a
                    href={`tel:${company.contact.phonesRaw[index]}`}
                    dir="ltr"
                    className="hover:text-white transition-colors"
                  >
                    {phone}
                  </a>
                </li>
              ))}
              <li className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-[#b98f42] shrink-0" />
                <a
                  href={company.contact.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="hover:text-white transition-colors"
                >
                  {company.contact.website}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-10 border-t border-white/10 text-center text-gray-500 text-sm">
          <p>© {currentYear} ELITE Real Estate. All rights reserved. Designed for Luxury.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
