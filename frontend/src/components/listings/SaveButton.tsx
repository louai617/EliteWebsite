'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { useSavedHomes } from '@/lib/saved-homes';

/** Heart toggle. Saved homes stay in the visitor's browser (see lib/saved-homes). */
export default function SaveButton({ reference, variant = 'icon', className = '' }: { reference: string; variant?: 'icon' | 'button'; className?: string }) {
  const t = useTranslations('property');
  const { isSaved, toggle } = useSavedHomes();
  const saved = isSaved(reference);
  const label = saved ? t('saved') : t('save');

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={() => toggle(reference)}
        aria-pressed={saved}
        className={`flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}
      >
        <Heart className={`h-4 w-4 transition ${saved ? 'fill-red-500 text-red-500' : ''}`} aria-hidden="true" />
        {saved ? t('saved') : t('save')}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        // Cards are links: keep the click on the heart.
        e.preventDefault();
        e.stopPropagation();
        toggle(reference);
      }}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <Heart className={`h-4 w-4 transition ${saved ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} aria-hidden="true" />
    </button>
  );
}
