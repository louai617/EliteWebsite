'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Preferences } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Card, cn, PageTitle, Section } from '@/components/portal/ui';

const input = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-[#b98f42] focus:ring-2 focus:ring-[#b98f42]/20';
const chip = (on: boolean) => cn('rounded-full border px-3 py-1.5 text-sm font-medium transition', on ? 'border-[#b98f42] bg-[#b98f42] text-white' : 'border-gray-200 text-gray-600 hover:border-[#b98f42]');

function PreferencesForm({ initial }: { initial: Preferences }) {
  const locale = useLocale();
  const [purpose, setPurpose] = useState<'SALE' | 'RENT' | null>(initial.purpose);
  const [types, setTypes] = useState<string[]>(initial.types);
  const [areas, setAreas] = useState<string[]>(initial.areas);
  const [bedrooms, setBedrooms] = useState<string>(initial.bedrooms == null ? '' : String(initial.bedrooms));
  const [budgetMin, setBudgetMin] = useState(initial.budgetMin == null ? '' : String(initial.budgetMin));
  const [budgetMax, setBudgetMax] = useState(initial.budgetMax == null ? '' : String(initial.budgetMax));
  const [requirements, setRequirements] = useState(initial.requirements ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const toggle = (list: string[], set: (v: string[]) => void, value: string) => set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const digits = (v: string) => v.replace(/\D/g, '');

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setStatus(null);
        setFields({});
        try {
          await api.put('/portal/preferences', {
            purpose,
            types,
            areas,
            bedrooms: bedrooms === '' ? null : Number(bedrooms),
            budgetMin: budgetMin === '' ? null : Number(budgetMin),
            budgetMax: budgetMax === '' ? null : Number(budgetMax),
            requirements: requirements.trim(),
          });
          setStatus({ ok: true, text: 'Saved. Your matches and your agent are updated.' });
        } catch (err) {
          if (err instanceof ApiError && err.fields) setFields(err.fields);
          setStatus({ ok: false, text: errorMessage(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Card className="space-y-6 p-6">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">I want to</p>
          <div className="flex flex-wrap gap-2">
            {([['SALE', 'Buy'], ['RENT', 'Rent'], [null, 'Either']] as const).map(([value, text]) => (
              <button key={text} type="button" className={chip(purpose === value)} onClick={() => setPurpose(value)} aria-pressed={purpose === value}>
                {text}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Property types</p>
          <div className="flex flex-wrap gap-2">
            {initial.options.types.map((t) => (
              <button key={t.value} type="button" className={chip(types.includes(t.value))} onClick={() => toggle(types, setTypes, t.value)} aria-pressed={types.includes(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Areas</p>
          <div className="flex flex-wrap gap-2">
            {initial.options.areas.map((a) => (
              <button key={a} type="button" className={chip(areas.includes(a))} onClick={() => toggle(areas, setAreas, a)} aria-pressed={areas.includes(a)}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Bedrooms (min)</span>
            <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className={input}>
              <option value="">Any</option>
              <option value="0">Studio+</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Budget from (QAR)</span>
            <input inputMode="numeric" value={budgetMin} onChange={(e) => setBudgetMin(digits(e.target.value))} className={input} placeholder="No minimum" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Budget up to (QAR)</span>
            <input inputMode="numeric" value={budgetMax} onChange={(e) => setBudgetMax(digits(e.target.value))} className={input} placeholder="No maximum" />
            {fields.budgetMax && <span className="mt-1 block text-xs text-red-600">{fields.budgetMax[0]}</span>}
          </label>
        </div>
        <p className="-mt-3 text-xs text-gray-400">For rentals, enter the monthly rent.</p>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Anything else?</span>
          <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={3} maxLength={1000} className={input} placeholder="Sea view, close to a school, pet friendly…" />
        </label>
      </Card>
      {status && (
        <p className={cn('flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium', status.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')} role="status">
          {status.ok && <CheckCircle2 className="h-4 w-4" />}
          {status.text}
          {status.ok && (
            <Link href={`/${locale}/dashboard/for-you`} className="ms-auto font-bold underline">
              See matches
            </Link>
          )}
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded-xl bg-[#1a1a1a] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#b98f42] disabled:opacity-50">
        {busy ? 'Saving…' : 'Save preferences'}
      </button>
    </form>
  );
}

export default function PreferencesPage() {
  const state = usePortal<Preferences>('/portal/preferences');
  return (
    <>
      <PageTitle title="Search preferences" description="What you're looking for. We use it for your matches, and your agent sees it in the CRM." />
      <Section state={state}>{(prefs) => <PreferencesForm initial={prefs} />}</Section>
    </>
  );
}
