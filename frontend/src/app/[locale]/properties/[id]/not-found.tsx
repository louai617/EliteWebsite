'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { SearchX, ArrowRight } from 'lucide-react';

/**
 * Shown when a listing id doesn't resolve. Segment-level so the surrounding
 * locale layout (and its i18n provider) still wraps it.
 */
export default function PropertyNotFound() {
  const t = useTranslations('property');
  const locale = useLocale();

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-primary">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </span>

        <h1 className="text-2xl font-bold text-secondary md:text-3xl">{t('not_found')}</h1>
        <p className="mt-3 text-gray-500">{t('not_found_body')}</p>

        <Link
          href={`/${locale}/properties`}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-secondary px-6 py-3.5 font-bold text-white transition hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('browse_all')}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
