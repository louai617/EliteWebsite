'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard, KeyRound, Landmark, Loader2, ShieldCheck, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import type { Reservation, ReservationQuote } from '@/lib/api-types';
import { PaymentDetails, ReceiptUpload } from './PaymentDetails';

const TZ = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'Asia/Qatar';

/**
 * Reserve a home with a booking deposit. Fawran / bank transfer today; card payments are
 * shown as "coming soon". The reservation lands in the agent app (Reservations).
 */
export default function ReserveHome({ reference }: { reference: string }) {
  const t = useTranslations('reserve');
  const locale = useLocale();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<ReservationQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reserved, setReserved] = useState<Reservation | null>(null);
  const isClient = user?.app === 'portal';
  const fmt = (n: number, c = 'QAR') => `${c} ${n.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US')}`;

  useEffect(() => {
    if (!open || !isClient || quote) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch below
    setLoading(true);
    api
      .get<ReservationQuote>(`/portal/reservations/quote?property=${encodeURIComponent(reference)}`)
      .then((q) => !cancelled && setQuote(q))
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, isClient, quote, reference]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const reserve = async () => {
    setBusy(true);
    setError(null);
    try {
      setReserved(await api.post<Reservation>('/portal/reservations', { property: reference, method: 'FAWRAN', note: note.trim() }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const fawran = quote?.methods.find((m) => m.method === 'FAWRAN');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary py-3 font-bold text-primary transition hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {t('reserve')}
      </button>

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="reserve-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="reserve-title" className="text-xl font-bold text-secondary">
                  {reserved ? t('success_title') : t('title')}
                </h2>
                {!reserved && <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!user ? (
              <div className="rounded-2xl bg-gray-50 p-6 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <p className="mt-3 font-bold text-secondary">{t('sign_in_title')}</p>
                <p className="mt-1 text-sm text-gray-500">{t('sign_in_body')}</p>
                <div className="mt-5 flex justify-center gap-3">
                  <Link href={`/${locale}/login?next=${encodeURIComponent(pathname)}`} className="rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
                    Sign in
                  </Link>
                  <Link href={`/${locale}/register?next=${encodeURIComponent(pathname)}`} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-secondary hover:border-primary">
                    Create account
                  </Link>
                </div>
              </div>
            ) : !isClient ? (
              <p className="rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-600">{t('staff_note')}</p>
            ) : reserved && quote ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">{t('success_body', { reference: reserved.reference })}</p>
                <p className="text-sm font-bold text-amber-700">
                  {t('pay_by', { date: new Date(reserved.payBy).toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ }) })}
                </p>
                <PaymentDetails reference={reserved.reference} amount={fmt(reserved.amount, reserved.currency)} bank={quote.bank} />
                <div className="flex flex-wrap items-start gap-3">
                  <ReceiptUpload reservationId={reserved.id} />
                  <Link href={`/${locale}/dashboard/bookings#reservations`} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-secondary hover:border-primary">
                    {t('view_reservations')}
                  </Link>
                </div>
              </div>
            ) : loading || !quote ? (
              error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> …
                </p>
              )
            ) : quote.existing ? (
              <div className="rounded-2xl bg-gray-50 p-6 text-center">
                <p className="font-bold text-secondary">{t('existing', { reference: quote.existing.reference })}</p>
                <Link href={`/${locale}/dashboard/bookings#reservations`} className="mt-4 inline-block rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
                  {t('view_reservations')}
                </Link>
              </div>
            ) : !quote.available ? (
              <p className="rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-600">{t('unavailable')}</p>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl bg-[#b98f42]/10 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#8a6a2f]">{t('deposit')}</p>
                  <p className="mt-1 text-3xl font-bold text-secondary">{fmt(quote.amount, quote.currency)}</p>
                  <p className="mt-1 text-xs text-gray-600">{t('deposit_note', { hours: quote.holdHours })}</p>
                </div>
                <fieldset>
                  <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('method')}</legend>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${fawran?.enabled ? 'border-primary bg-primary/5' : 'border-gray-200 opacity-60'}`}>
                      <input type="radio" name="method" checked={Boolean(fawran?.enabled)} readOnly disabled={!fawran?.enabled} className="mt-1 accent-[#b98f42]" />
                      <Landmark className="h-5 w-5 flex-none text-primary" />
                      <span>
                        <span className="block font-bold text-secondary">{t('fawran')}</span>
                        <span className="block text-xs text-gray-500">{fawran?.enabled ? t('fawran_note') : t('not_open')}</span>
                      </span>
                    </label>
                    <label className="flex cursor-not-allowed items-start gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-4 opacity-70" aria-disabled="true">
                      <input type="radio" name="method" disabled className="mt-1" />
                      <CreditCard className="h-5 w-5 flex-none text-gray-400" />
                      <span className="flex-1">
                        <span className="block font-bold text-gray-500">{t('card')}</span>
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500">{t('coming_soon')}</span>
                    </label>
                  </div>
                </fieldset>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('note_label')}</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary" />
                </label>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void reserve()}
                  disabled={busy || !fawran?.enabled}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3.5 font-bold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? t('reserving') : t('confirm')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
