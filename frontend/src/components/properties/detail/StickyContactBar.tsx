'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Phone, MessageSquare } from 'lucide-react';

interface StickyContactBarProps {
  phone: string;
  whatsapp: string;
  price: string;
  shareTitle: string;
}

/**
 * Mobile-only contact bar. Stays out of the way until the reader has scrolled
 * past the gallery, so it never covers the first impression of the property.
 */
export default function StickyContactBar({
  phone,
  whatsapp,
  price,
  shareTitle,
}: StickyContactBarProps) {
  const t = useTranslations('property');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-md transition-transform duration-300 lg:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      // Hidden from assistive tech while off-screen so it isn't announced early.
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-lg font-bold text-secondary">{price}</p>
        <a
          href={`tel:${phone.replace(/\s+/g, '')}`}
          tabIndex={visible ? 0 : -1}
          className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          {t('call')}
        </a>
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(shareTitle)}`}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={visible ? 0 : -1}
          className="flex items-center gap-2 rounded-xl border-2 border-primary px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary hover:text-white"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t('whatsapp')}</span>
        </a>
      </div>
    </div>
  );
}
