'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Clock, FileText, Loader2, Phone, ShieldCheck, XCircle } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { GuestReservation, ReservationStatus } from '@/lib/api-types';
import PropertyCard from '@/components/properties/PropertyCard';
import { PaymentDetails, ReceiptUpload } from './PaymentDetails';

const TZ = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'Asia/Qatar';

const STATUS_STYLE: Record<ReservationStatus, { icon: typeof Clock; className: string }> = {
  AWAITING_PAYMENT: { icon: Clock, className: 'bg-amber-50 text-amber-800' },
  PAYMENT_SUBMITTED: { icon: ShieldCheck, className: 'bg-sky-50 text-sky-800' },
  CONFIRMED: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-800' },
  CANCELLED: { icon: XCircle, className: 'bg-gray-100 text-gray-700' },
};

/**
 * The visitor's private reservation page (/reservation/:token, the link from the e-mail):
 * status, bank details, the receipt upload and contact with the agent. No account needed.
 */
export default function ReservationView({ token }: { token: string }) {
  const t = useTranslations('reservation');
  const locale = useLocale();
  const [data, setData] = useState<GuestReservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payer, setPayer] = useState({ payerName: '', paymentReference: '' });
  const [saved, setSaved] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const fmt = (n: number, c = 'QAR') => `${c} ${n.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US')}`;
  const when = (iso: string) => new Date(iso).toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ });

  const load = useCallback(
    (signal?: AbortSignal) =>
      api
        .get<GuestReservation>(`/public/reservations/${encodeURIComponent(token)}`, signal)
        .then((r) => {
          setData(r);
          setPayer({ payerName: r.payerName ?? '', paymentReference: r.paymentReference ?? '' });
          setError(null);
        })
        .catch((err) => {
          if (!signal?.aborted) setError(errorMessage(err, t('not_found')));
        }),
    [token, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const savePayer = async () => {
    setBusy(true);
    try {
      await api.patch(`/public/reservations/${encodeURIComponent(token)}`, { payerName: payer.payerName.trim(), paymentReference: payer.paymentReference.trim() });
      setSaved(t('details_saved'));
    } catch (err) {
      setSaved(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.del(`/public/reservations/${encodeURIComponent(token)}`, { reason: reason.trim() });
      setCancelling(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return error ? (
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
        <XCircle className="mx-auto h-10 w-10 text-gray-300" />
        <h1 className="mt-4 text-xl font-bold text-secondary">{t('not_found_title')}</h1>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        <Link href={`/${locale}/properties`} className="mt-6 inline-block rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
          {t('browse')}
        </Link>
      </div>
    ) : (
      <p className="flex items-center justify-center gap-2 py-24 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
      </p>
    );
  }

  const style = STATUS_STYLE[data.status];
  const StatusIcon = style.icon;
  const awaiting = data.status === 'AWAITING_PAYMENT';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{t('reservation')} {data.reference}</p>
          <h1 className="mt-1 text-2xl font-bold text-secondary">{t('hello', { name: data.name.split(' ')[0] })}</h1>
          <div className={`mt-4 flex items-start gap-3 rounded-2xl p-4 ${style.className}`}>
            <StatusIcon className="mt-0.5 h-5 w-5 flex-none" />
            <div>
              <p className="font-bold">{t(`status_${data.status}`)}</p>
              <p className="mt-0.5 text-sm">
                {awaiting
                  ? t('awaiting_body', { amount: fmt(data.amount, data.currency), date: when(data.payBy) })
                  : data.status === 'CANCELLED'
                    ? data.cancelReason ?? ''
                    : t(`body_${data.status}`)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">{t('private_link')}</p>
        </section>

        {data.canUpload && (
          <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold text-secondary">{awaiting ? t('pay_title') : t('pay_again_title')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('pay_body', { reference: data.reference })}</p>
            <div className="mt-4">
              <PaymentDetails reference={data.reference} amount={fmt(data.amount, data.currency)} bank={data.bank} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('payer_name')}</span>
                <input value={payer.payerName} onChange={(e) => setPayer({ ...payer, payerName: e.target.value })} maxLength={120} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('payment_reference')}</span>
                <input value={payer.paymentReference} onChange={(e) => setPayer({ ...payer, paymentReference: e.target.value })} maxLength={80} dir="ltr" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" disabled={busy} onClick={() => void savePayer()} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-secondary hover:border-primary disabled:opacity-60">
                {t('save_details')}
              </button>
              {saved && <span className="text-sm text-gray-500" role="status">{saved}</span>}
            </div>
            <div className="mt-6 border-t border-gray-100 pt-5">
              <ReceiptUpload token={token} onDone={() => void load()} />
            </div>
          </section>
        )}

        {data.receipts.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold text-secondary">{t('receipts')}</h2>
            <ul className="mt-3 space-y-2">
              {data.receipts.map((r) => (
                <li key={`${r.fileName}-${r.uploadedAt}`} className="flex items-center gap-2 text-sm text-gray-700">
                  <FileText className="h-4 w-4 text-primary" /> {r.fileName}
                  <span className="text-xs text-gray-400">· {when(r.uploadedAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.canCancel && (
          <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            {cancelling ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('cancel_reason')}</span>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary" />
                </label>
                <div className="flex gap-3">
                  <button type="button" disabled={busy} onClick={() => void cancel()} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">
                    {t('cancel_confirm')}
                  </button>
                  <button type="button" onClick={() => setCancelling(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-secondary">
                    {t('keep')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setCancelling(true)} className="text-sm font-bold text-red-600 hover:underline">
                {t('cancel')}
              </button>
            )}
          </section>
        )}
      </div>

      <aside className="space-y-6">
        <PropertyCard property={data.property} />
        {data.agent && (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{t('your_agent')}</p>
            <p className="mt-1 font-bold text-secondary">{data.agent.name}</p>
            {data.agent.phone && (
              <a href={`tel:${data.agent.phone.replace(/[^+0-9]/g, '')}`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-white hover:bg-primary" dir="ltr">
                <Phone className="h-4 w-4" /> {data.agent.phone}
              </a>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
