'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';

const TZ = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'Asia/Qatar';

export interface Slot {
  startsAt: string;
  label: string;
  available: boolean;
}

/** The next `n` calendar days in the business time zone, as YYYY-MM-DD. */
function nextDays(n: number) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return Array.from({ length: n }, (_, i) => fmt.format(new Date(Date.now() + i * 86_400_000)));
}

/** Day chips + free time slots for a listing (the agent's calendar is checked server-side). */
export default function SlotPicker({ reference, value, onChange, reloadKey = 0 }: { reference: string; value: string | null; onChange: (slot: string | null) => void; reloadKey?: number }) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const days = useMemo(() => nextDays(14), []);
  const [day, setDay] = useState(days[0]);
  const [result, setResult] = useState<{ key: string; slots: Slot[] | null; error: string | null }>({ key: '', slots: null, error: null });
  const key = `${day}#${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ slots: Slot[] }>(`/public/viewings/slots?property=${encodeURIComponent(reference)}&date=${day}`, controller.signal)
      .then((r) => setResult({ key, slots: r.slots, error: null }))
      .catch((err) => {
        if (!controller.signal.aborted) setResult({ key, slots: [], error: errorMessage(err, t('error')) });
      });
    return () => controller.abort();
  }, [reference, day, key, t]);

  const loading = result.key !== key;
  const slots = loading ? null : result.slots;
  const dayLabel = (d: string) => {
    const date = new Date(`${d}T12:00:00Z`);
    const loc = locale === 'ar' ? 'ar-QA' : 'en-GB';
    return { weekday: date.toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' }), day: date.toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' }) };
  };

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('choose_day')}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map((d) => {
          const l = dayLabel(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDay(d);
                onChange(null);
              }}
              aria-pressed={day === d}
              className={`flex min-w-[68px] flex-col items-center rounded-xl border px-2 py-2 text-xs transition ${day === d ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:border-primary'}`}
            >
              <span className="font-semibold">{l.weekday}</span>
              <span>{l.day}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('choose_time')}</p>
      {!slots ? (
        <p className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
        </p>
      ) : result.error ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{result.error}</p>
      ) : slots.filter((s) => s.available).length === 0 ? (
        <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">{t('no_slots')}</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((s) => (
            <button
              key={s.startsAt}
              type="button"
              disabled={!s.available}
              onClick={() => onChange(s.startsAt)}
              aria-pressed={value === s.startsAt}
              className={`rounded-lg border py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300 disabled:line-through ${value === s.startsAt ? 'border-primary bg-primary text-white' : 'border-gray-200 text-secondary hover:border-primary'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
