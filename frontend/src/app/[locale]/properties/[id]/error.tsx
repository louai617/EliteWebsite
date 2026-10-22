'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { RotateCcw, WifiOff } from 'lucide-react';

/** Shown when the listing can't be loaded from the CRM (network or server issue). */
export default function ListingError({ reset }: { error: Error; reset: () => void }) {
  const locale = useLocale();
  const ar = locale === 'ar';
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 pt-20">
      <div className="max-w-md rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <WifiOff className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold text-secondary">{ar ? 'تعذر تحميل العقار' : "We couldn't load this property"}</h1>
        <p className="mt-2 text-sm text-gray-500">{ar ? 'يرجى المحاولة مرة أخرى بعد قليل.' : 'Please try again in a moment.'}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
            <RotateCcw className="h-4 w-4" /> {ar ? 'إعادة المحاولة' : 'Try again'}
          </button>
          <Link href={`/${locale}/properties`} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-secondary hover:border-primary">
            {ar ? 'كل العقارات' : 'All properties'}
          </Link>
        </div>
      </div>
    </main>
  );
}
