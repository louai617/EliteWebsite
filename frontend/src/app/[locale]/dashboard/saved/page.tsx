'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, Columns3, Heart, X } from 'lucide-react';
import type { SavedHome } from '@/lib/api-types';
import { pricePerSqm } from '@/lib/listing-types';
import { usePortal } from '@/components/portal/use-portal';
import { Card, date, Empty, label, money, PageTitle, Section } from '@/components/portal/ui';
import PropertyCard from '@/components/properties/PropertyCard';

const MAX_COMPARE = 3;

function PriceChange({ home }: { home: SavedHome }) {
  if (!home.priceChangePercent || !home.priceAtSave) return <span className="text-gray-400">Saved {date(home.savedAt)}</span>;
  const down = home.priceChangePercent < 0;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${down ? 'text-emerald-700' : 'text-red-600'}`}>
      <Icon className="h-3.5 w-3.5" />
      {down ? 'Price dropped' : 'Price up'} {Math.abs(home.priceChangePercent)}% · was {money(home.priceAtSave, home.property.currency)}
    </span>
  );
}

/** Side-by-side comparison of up to three saved homes. */
function Compare({ homes, onClose }: { homes: SavedHome[]; onClose: () => void }) {
  const locale = useLocale();
  const rows: { label: string; value: (h: SavedHome) => React.ReactNode }[] = [
    { label: 'Price', value: (h) => <span className="font-bold text-[#b98f42]">{money(h.property.price, h.property.currency)}{h.property.price_frequency === 'month' ? ' /mo' : ''}</span> },
    { label: 'Price per m²', value: (h) => (pricePerSqm(h.property) ? `${money(pricePerSqm(h.property)!, h.property.currency)}${h.property.price_frequency ? ' /yr' : ''}` : '—') },
    { label: 'Type', value: (h) => label(h.property.type) },
    { label: 'Area', value: (h) => `${h.property.location.area_en}, ${h.property.location.city_en}` },
    { label: 'Bedrooms', value: (h) => (h.property.bedrooms === 0 ? 'Studio' : (h.property.bedrooms ?? '—')) },
    { label: 'Bathrooms', value: (h) => h.property.bathrooms ?? '—' },
    { label: 'Size', value: (h) => (h.property.area_sqm ? `${h.property.area_sqm} m²` : '—') },
    { label: 'Parking', value: (h) => h.property.parking },
    { label: 'Completion', value: (h) => (h.property.completion === 'offplan' ? 'Off-plan' : 'Ready') },
    { label: 'Since saved', value: (h) => <PriceChange home={h} /> },
  ];
  return (
    <Card className="mb-6 overflow-x-auto p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-gray-900">Compare</h2>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-900">
          <X className="h-4 w-4" /> Close
        </button>
      </div>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr>
            <th className="w-36" />
            {homes.map((h) => (
              <th key={h.property._id} className="px-3 pb-3 text-start align-bottom">
                <Link href={`/${locale}/properties/${encodeURIComponent(h.property._id)}`} className="font-bold text-gray-900 hover:text-[#b98f42]">
                  {h.property.title_en}
                </Link>
                <p className="text-xs font-normal text-gray-400">{h.property.reference_number}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.label}>
              <th className="py-2.5 text-start text-xs font-bold uppercase tracking-wider text-gray-400">{row.label}</th>
              {homes.map((h) => (
                <td key={h.property._id} className="px-3 py-2.5 text-gray-700">
                  {row.value(h)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function SavedHomesPage() {
  const locale = useLocale();
  const state = usePortal<SavedHome[]>('/portal/saved');
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const toggle = (ref: string) => setSelected((s) => (s.includes(ref) ? s.filter((r) => r !== ref) : s.length >= MAX_COMPARE ? s : [...s, ref]));

  return (
    <>
      <PageTitle
        title="Saved homes"
        description="Tap the heart on any listing to save it. Your agent sees your shortlist too."
        actions={
          selected.length >= 2 ? (
            <button type="button" onClick={() => setComparing(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#b98f42]">
              <Columns3 className="h-4 w-4" /> Compare {selected.length}
            </button>
          ) : undefined
        }
      />
      <Section
        state={state}
        empty={(rows) =>
          rows.length === 0 ? (
            <Card>
              <Empty icon={Heart} title="No saved homes yet" description="Browse properties and tap the heart to keep track of homes you like — we'll show price drops here." />
              <div className="pb-8 text-center">
                <Link href={`/${locale}/properties`} className="rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#b98f42]">
                  Browse properties
                </Link>
              </div>
            </Card>
          ) : null
        }
      >
        {(rows) => {
          const compareHomes = rows.filter((r) => selected.includes(r.property._id));
          const drops = rows.filter((r) => r.priceChangePercent < 0).length;
          return (
            <>
              {drops > 0 && (
                <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  Good news: {drops} of your saved home{drops === 1 ? ' has' : 's have'} dropped in price.
                </p>
              )}
              {comparing && compareHomes.length >= 2 && <Compare homes={compareHomes} onClose={() => setComparing(false)} />}
              <p className="mb-3 text-xs text-gray-500">Select up to {MAX_COMPARE} homes to compare them side by side.</p>
              <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
                {rows.map((home) => (
                  <div key={home.property._id} className={home.live ? '' : 'opacity-60'}>
                    <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-600">
                      <input type="checkbox" checked={selected.includes(home.property._id)} onChange={() => toggle(home.property._id)} disabled={!selected.includes(home.property._id) && selected.length >= MAX_COMPARE} className="h-4 w-4 accent-[#b98f42]" />
                      Compare
                      {!home.live && <span className="ms-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">No longer available</span>}
                    </label>
                    <PropertyCard property={home.property} footer={<PriceChange home={home} />} />
                  </div>
                ))}
              </div>
            </>
          );
        }}
      </Section>
    </>
  );
}
