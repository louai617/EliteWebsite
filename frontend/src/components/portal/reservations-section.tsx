'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CheckCircle2, Clock, FileCheck2, KeyRound, XCircle } from 'lucide-react';
import { api, documentUrl, errorMessage } from '@/lib/api';
import type { BankDetails, PaymentMethodOption, Reservation } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Badge, Card, cn, dateTime, money } from '@/components/portal/ui';
import { PaymentDetails, ReceiptUpload } from '@/components/listings/PaymentDetails';

const STATUS: Record<Reservation['status'], { label: string; tone: 'amber' | 'blue' | 'green' | 'gray' }> = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'amber' },
  PAYMENT_SUBMITTED: { label: 'Payment being verified', tone: 'blue' },
  CONFIRMED: { label: 'Reserved for you', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
};

function ReservationCard({ r, bank, onChange }: { r: Reservation; bank: BankDetails; onChange: () => void }) {
  const locale = useLocale();
  const [showPay, setShowPay] = useState(r.status === 'AWAITING_PAYMENT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = [
    { label: 'Reserved', done: true },
    { label: 'Deposit paid', done: r.status === 'PAYMENT_SUBMITTED' || r.status === 'CONFIRMED' },
    { label: 'Confirmed', done: r.status === 'CONFIRMED' },
  ];

  const cancel = async () => {
    if (!window.confirm(`Cancel reservation ${r.reference}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.del(`/portal/reservations/${r.id}`, { reason: 'Changed my mind' });
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn('overflow-hidden', r.status === 'CANCELLED' && 'opacity-70')}>
      <div className="flex flex-wrap items-start gap-4 p-5">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#b98f42]/10 text-[#b98f42]">
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
            <span className="font-mono text-xs text-gray-500">{r.reference}</span>
          </div>
          <Link href={`/${locale}/properties/${encodeURIComponent(r.property._id)}`} className="mt-1 block font-bold text-gray-900 hover:text-[#b98f42]">
            {r.property.title_en}
          </Link>
          <p className="text-sm text-gray-500">
            Deposit <span className="font-bold text-gray-900">{money(r.amount, r.currency)}</span>
            {r.status === 'AWAITING_PAYMENT' && <span className="text-amber-700"> · pay by {dateTime(r.payBy)}</span>}
            {r.status === 'CONFIRMED' && r.verifiedAt && <span> · confirmed {dateTime(r.verifiedAt)}</span>}
          </p>
          {r.cancelReason && <p className="mt-1 text-sm text-gray-500">{r.cancelReason}</p>}
        </div>
      </div>

      {r.status !== 'CANCELLED' && (
        <ol className="grid grid-cols-3 gap-2 px-5 pb-4">
          {steps.map((s) => (
            <li key={s.label}>
              <div className={cn('h-1.5 rounded-full', s.done ? 'bg-[#b98f42]' : 'bg-gray-200')} />
              <p className={cn('mt-1.5 text-xs', s.done ? 'font-bold text-gray-900' : 'text-gray-400')}>{s.label}</p>
            </li>
          ))}
        </ol>
      )}

      {r.canUpload && (
        <div className="space-y-4 border-t border-gray-100 bg-gray-50/60 p-5">
          {r.status === 'PAYMENT_SUBMITTED' ? (
            <p className="flex items-center gap-2 text-sm text-sky-800">
              <Clock className="h-4 w-4" /> We received your receipt. Your agent is checking the payment and will confirm shortly.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Pay the deposit with <strong>Fawran</strong> or a bank transfer, write <strong className="font-mono">{r.reference}</strong> as the reference, then upload the receipt.
            </p>
          )}
          <button type="button" onClick={() => setShowPay((v) => !v)} className="text-sm font-bold text-[#b98f42] hover:underline">
            {showPay ? 'Hide payment details' : 'Show payment details'}
          </button>
          {showPay && <PaymentDetails reference={r.reference} amount={money(r.amount, r.currency)} bank={bank} />}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ReceiptUpload reservationId={r.id} onDone={onChange} />
            {r.canCancel && (
              <button type="button" disabled={busy} onClick={() => void cancel()} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
                <XCircle className="h-4 w-4" /> Cancel reservation
              </button>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {r.documents.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-5 py-3">
          {r.documents.map((d) => (
            <a key={d.id} href={documentUrl(d.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">
              <FileCheck2 className="h-3.5 w-3.5" /> {d.fileName}
            </a>
          ))}
        </div>
      )}
      {r.status === 'CONFIRMED' && (
        <p className="flex items-center gap-2 border-t border-gray-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> This home is reserved for you. {r.agent ? `${r.agent.name} will contact you about the contract.` : 'Your agent will contact you about the contract.'}
        </p>
      )}
    </Card>
  );
}

/** "Reservations" on the Bookings page: deposits paid by Fawran / bank transfer (cards coming soon). */
export function ReservationsSection() {
  const state = usePortal<{ items: Reservation[]; bank: BankDetails; methods: PaymentMethodOption[]; holdHours: number }>('/portal/reservations');
  if (!state.data || state.data.items.length === 0) return null;
  const { items, bank } = state.data;
  return (
    <section id="reservations" className="mb-8 scroll-mt-28">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">Reservations</h2>
      <div className="space-y-4">
        {items.map((r) => (
          <ReservationCard key={r.id} r={r} bank={bank} onChange={state.reload} />
        ))}
      </div>
    </section>
  );
}
