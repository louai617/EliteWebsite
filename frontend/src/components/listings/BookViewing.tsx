'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarCheck, CalendarDays, CalendarPlus, Loader2, X } from 'lucide-react';
import SlotPicker from './SlotPicker';
import { api, API_URL, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const TZ = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'Asia/Qatar';

/**
 * Book a viewing on a listing. The booking goes straight into the CRM: the agent gets a
 * "confirm" task and the client sees it in their dashboard.
 */
export default function BookViewing({ reference, agentName, variant = 'primary', className = '' }: { reference: string; agentName: string; variant?: 'primary' | 'compact'; className?: string }) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<{ id: string; startsAt: string } | null>(null);
  const isClient = user?.app === 'portal';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const book = async () => {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ id: string; startsAt: string }>('/portal/bookings', { property: reference, startsAt: slot, note: note.trim() });
      setBooked(res);
    } catch (err) {
      setError(errorMessage(err, t('error')));
      // A slot may have just been taken: reload the times.
      setSlot(null);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setBooked(null);
        }}
        className={
          variant === 'primary'
            ? `flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-white transition hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`
            : `flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white ${className}`
        }
      >
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        {t('book_viewing')}
      </button>

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-viewing-title"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="book-viewing-title" className="text-xl font-bold text-secondary">
                  {t('title')}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!user ? (
              <div className="rounded-2xl bg-gray-50 p-6 text-center">
                <CalendarCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <p className="mt-3 font-bold text-secondary">{t('sign_in_title')}</p>
                <p className="mt-1 text-sm text-gray-500">{t('sign_in_body')}</p>
                <div className="mt-5 flex justify-center gap-3">
                  <Link href={`/${locale}/login?next=${encodeURIComponent(pathname)}`} className="rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
                    {t('sign_in')}
                  </Link>
                  <Link href={`/${locale}/register?next=${encodeURIComponent(pathname)}`} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-secondary hover:border-primary">
                    {t('create_account')}
                  </Link>
                </div>
              </div>
            ) : !isClient ? (
              <p className="rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-600">{t('staff_note')}</p>
            ) : booked ? (
              <div className="rounded-2xl bg-emerald-50 p-6 text-center">
                <CalendarCheck className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
                <p className="mt-3 text-lg font-bold text-secondary">{t('success_title')}</p>
                <p className="mt-1 font-medium text-emerald-800">{when(booked.startsAt)}</p>
                <p className="mt-2 text-sm text-gray-600">{t('success_body', { agent: agentName })}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link href={`/${locale}/dashboard/bookings`} className="rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
                    {t('view_bookings')}
                  </Link>
                  <a href={`${API_URL}/portal/bookings/${booked.id}/calendar`} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-secondary hover:border-primary">
                    <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                    {t('add_calendar')}
                  </a>
                </div>
              </div>
            ) : (
              <>
                <SlotPicker reference={reference} value={slot} onChange={setSlot} reloadKey={reloadKey} />

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('note_label')}</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder={t('note_placeholder')}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>

                {error && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void book()}
                  disabled={!slot || busy}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3.5 font-bold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? t('booking') : t('confirm')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
