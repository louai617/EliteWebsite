'use client';

import React, { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';

const TYPES = ['apartment', 'villa', 'townhouse', 'penthouse', 'studio', 'duplex', 'compound_villa', 'office', 'shop', 'warehouse', 'land', 'building'];

/** Filter bar for the listings page. All state lives in the URL, so searches are shareable. */
export default function ListingFilters({ areas }: { areas: { value: string; label_en: string; label_ar: string; count: number }[] }) {
  const t = useTranslations('listings');
  const tp = useTranslations('property');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');

  const set = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    start(() => router.push(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false }));
  };

  const select = 'h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-primary';
  const hasFilters = ['q', 'purpose', 'category', 'type', 'area', 'beds', 'priceMin', 'priceMax'].some((k) => params.get(k));

  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition ${pending ? 'opacity-70' : ''}`}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: q.trim() || undefined });
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} placeholder={t('search_placeholder')} aria-label={t('search_placeholder')} className="h-11 w-full rounded-xl border border-gray-200 ps-9 pe-3 text-sm outline-none transition focus:border-primary" />
        </div>
        <button type="submit" className="h-11 rounded-xl bg-secondary px-5 text-sm font-bold text-white transition hover:bg-primary">
          {t('apply')}
        </button>
      </form>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        <select aria-label={t('purpose')} className={select} value={params.get('purpose') ?? ''} onChange={(e) => set({ purpose: e.target.value || undefined })}>
          <option value="">{t('purpose')}: {t('any')}</option>
          <option value="sale">{t('buy')}</option>
          <option value="rent">{t('rent')}</option>
        </select>
        <select aria-label={t('category')} className={select} value={params.get('category') ?? ''} onChange={(e) => set({ category: e.target.value || undefined })}>
          <option value="">{t('category')}: {t('any')}</option>
          <option value="residential">{t('residential')}</option>
          <option value="commercial">{t('commercial')}</option>
        </select>
        <select aria-label={t('type')} className={select} value={params.get('type') ?? ''} onChange={(e) => set({ type: e.target.value || undefined })}>
          <option value="">{t('type')}: {t('any')}</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {tp(`type_${type}`)}
            </option>
          ))}
        </select>
        <select aria-label={t('area')} className={select} value={params.get('area') ?? ''} onChange={(e) => set({ area: e.target.value || undefined })}>
          <option value="">{t('area')}: {t('any')}</option>
          {areas.map((a) => (
            <option key={a.value} value={a.value}>
              {locale === 'ar' ? a.label_ar : a.label_en} ({a.count})
            </option>
          ))}
        </select>
        <select aria-label={t('beds')} className={select} value={params.get('beds') ?? ''} onChange={(e) => set({ beds: e.target.value || undefined })}>
          <option value="">{t('beds')}: {t('any')}</option>
          <option value="0">{tp('studio')}+</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {t('beds_n', { count: n })}
            </option>
          ))}
        </select>
        <input aria-label={t('price_min')} inputMode="numeric" placeholder={t('price_min')} defaultValue={params.get('priceMin') ?? ''} onBlur={(e) => set({ priceMin: e.target.value.replace(/\D/g, '') || undefined })} className={select} />
        <input aria-label={t('price_max')} inputMode="numeric" placeholder={t('price_max')} defaultValue={params.get('priceMax') ?? ''} onBlur={(e) => set({ priceMax: e.target.value.replace(/\D/g, '') || undefined })} className={select} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <select aria-label={t('sort')} className={`${select} h-9`} value={params.get('sort') ?? 'newest'} onChange={(e) => set({ sort: e.target.value === 'newest' ? undefined : e.target.value })}>
          <option value="newest">{t('sort_newest')}</option>
          <option value="price_asc">{t('sort_price_asc')}</option>
          <option value="price_desc">{t('sort_price_desc')}</option>
          <option value="size_desc">{t('sort_size_desc')}</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              start(() => router.push(pathname, { scroll: false }));
            }}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            <X className="h-4 w-4" aria-hidden="true" /> {t('clear')}
          </button>
        )}
      </div>
    </div>
  );
}
