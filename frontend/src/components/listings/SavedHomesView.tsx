'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Columns3, Heart, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { pricePerSqm, type ListingCard, type ListingPage } from '@/lib/listing-types';
import { useSavedHomes } from '@/lib/saved-homes';
import PropertyCard from '@/components/properties/PropertyCard';

const MAX_COMPARE = 3;

/** Side-by-side comparison of up to three saved homes. */
function Compare({ homes, onClose }: { homes: ListingCard[]; onClose: () => void }) {
  const t = useTranslations('saved');
  const locale = useLocale();
  const ar = locale === 'ar';
  const money = (n: number, c: string) => new Intl.NumberFormat(ar ? 'ar-QA' : 'en-QA', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
  const typeLabel = (v: string) => v.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const rows: { label: string; value: (h: ListingCard) => React.ReactNode }[] = [
    { label: t('price'), value: (h) => <span className="font-bold text-[#b98f42]">{money(h.price, h.currency)}{h.price_frequency === 'month' ? ` ${t('per_month')}` : ''}</span> },
    { label: t('price_sqm'), value: (h) => (pricePerSqm(h) ? `${money(pricePerSqm(h)!, h.currency)}${h.price_frequency ? ` ${t('per_year')}` : ''}` : '—') },
    { label: t('type'), value: (h) => typeLabel(h.type) },
    { label: t('area'), value: (h) => (ar ? `${h.location.area_ar}، ${h.location.city_ar}` : `${h.location.area_en}, ${h.location.city_en}`) },
    { label: t('bedrooms'), value: (h) => (h.bedrooms === 0 ? t('studio') : (h.bedrooms ?? '—')) },
    { label: t('bathrooms'), value: (h) => h.bathrooms ?? '—' },
    { label: t('size'), value: (h) => (h.area_sqm ? `${h.area_sqm} m²` : '—') },
    { label: t('parking'), value: (h) => h.parking },
    { label: t('completion'), value: (h) => (h.completion === 'offplan' ? t('offplan') : t('ready')) },
  ];
  return (
    <div className="mb-6 overflow-x-auto rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-gray-900">{t('compare_title')}</h2>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-900">
          <X className="h-4 w-4" /> {t('close')}
        </button>
      </div>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr>
            <th className="w-36" />
            {homes.map((h) => (
              <th key={h._id} className="px-3 pb-3 text-start align-bottom">
                <Link href={`/${locale}/properties/${encodeURIComponent(h._id)}`} className="font-bold text-gray-900 hover:text-[#b98f42]">
                  {ar ? h.title_ar : h.title_en}
                </Link>
                <p className="text-xs font-normal text-gray-400">{h.reference_number}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.label}>
              <th className="py-2.5 text-start text-xs font-bold uppercase tracking-wider text-gray-400">{row.label}</th>
              {homes.map((h) => (
                <td key={h._id} className="px-3 py-2.5 text-gray-700">
                  {row.value(h)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Saved homes (kept in this browser) with side-by-side compare. */
export default function SavedHomesView() {
  const t = useTranslations('saved');
  const locale = useLocale();
  const { refs, remove } = useSavedHomes();
  const key = refs.join(',');
  const [result, setResult] = useState<{ key: string; items: ListingCard[] | null }>({ key: '', items: null });
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    api
      .get<ListingPage>(`/public/properties?pageSize=48&refs=${encodeURIComponent(key)}`, controller.signal)
      .then((page) => setResult({ key, items: page.items }))
      .catch(() => !controller.signal.aborted && setResult({ key, items: [] }));
    return () => controller.abort();
  }, [key]);

  const loading = Boolean(key) && result.key !== key;
  const live = key && result.key === key ? (result.items ?? []) : [];
  // Keep the order the visitor saved them in (newest first).
  const homes = refs.map((r) => live.find((h) => h._id === r)).filter((h): h is ListingCard => Boolean(h));
  const gone = loading ? 0 : refs.length - homes.length;
  const picked = selected.filter((r) => homes.some((h) => h._id === r));
  const toggle = (ref: string) => setSelected((s) => (s.includes(ref) ? s.filter((r) => r !== ref) : s.length >= MAX_COMPARE ? s : [...s, ref]));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        {picked.length >= 2 && (
          <button type="button" onClick={() => setComparing(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#b98f42]">
            <Columns3 className="h-4 w-4" /> {t('compare_n', { count: picked.length })}
          </button>
        )}
      </div>

      {!refs.length ? (
        <div className="rounded-3xl bg-white px-6 py-16 text-center shadow-sm">
          <Heart className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 font-bold text-gray-900">{t('empty_title')}</p>
          <p className="mt-1 text-sm text-gray-500">{t('empty_body')}</p>
          <Link href={`/${locale}/properties`} className="mt-6 inline-block rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#b98f42]">
            {t('browse')}
          </Link>
        </div>
      ) : loading ? (
        <p className="flex items-center justify-center gap-2 py-24 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
        </p>
      ) : (
        <>
          {comparing && picked.length >= 2 && <Compare homes={homes.filter((h) => picked.includes(h._id))} onClose={() => setComparing(false)} />}
          {gone > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>{t('gone', { count: gone })}</span>
              <button type="button" onClick={() => refs.filter((r) => !homes.some((h) => h._id === r)).forEach(remove)} className="font-bold underline">
                {t('remove_gone')}
              </button>
            </div>
          )}
          {homes.length > 1 && <p className="mb-3 text-xs text-gray-500">{t('compare_hint', { max: MAX_COMPARE })}</p>}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {homes.map((home) => (
              <div key={home._id}>
                {homes.length > 1 && (
                  <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-600">
                    <input type="checkbox" checked={picked.includes(home._id)} onChange={() => toggle(home._id)} disabled={!picked.includes(home._id) && picked.length >= MAX_COMPARE} className="h-4 w-4 accent-[#b98f42]" />
                    {t('compare')}
                  </label>
                )}
                <PropertyCard property={home} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
