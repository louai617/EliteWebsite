'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CalendarClock, CalendarPlus, CheckCircle2, Clock, MapPin, MessageSquare, Navigation, Phone, X } from 'lucide-react';
import { api, API_URL, errorMessage } from '@/lib/api';
import type { Booking } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Badge, Card, cn, dateTime, Empty, PageTitle, Section } from '@/components/portal/ui';
import SlotPicker from '@/components/listings/SlotPicker';
import { ReservationsSection } from '@/components/portal/reservations-section';

const TZ = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'Asia/Qatar';

/** "in 3 days", "tomorrow", "in 4 hours". */
function countdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return 'starting soon';
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

function statusBadge(b: Booking) {
  if (b.awaitingConfirmation) return <Badge tone="amber">Awaiting agent confirmation</Badge>;
  if (b.status === 'CONFIRMED') return <Badge tone="green">Confirmed</Badge>;
  if (b.status === 'SCHEDULED') return <Badge tone="blue">Scheduled</Badge>;
  if (b.status === 'COMPLETED') return <Badge tone="green">Completed</Badge>;
  if (b.status === 'NO_SHOW') return <Badge>Missed</Badge>;
  return <Badge>Cancelled</Badge>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RescheduleDialog({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: () => void }) {
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <Dialog title="Reschedule viewing" onClose={onClose}>
      <p className="mb-4 text-sm text-gray-500">Currently {dateTime(booking.startsAt)}. Your agent confirms the new time.</p>
      <SlotPicker reference={booking.property._id} value={slot} onChange={setSlot} reloadKey={reloadKey} />
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <button
        type="button"
        disabled={!slot || busy}
        onClick={async () => {
          if (!slot) return;
          setBusy(true);
          setError(null);
          try {
            await api.patch(`/portal/bookings/${booking.id}`, { startsAt: slot });
            onDone();
          } catch (err) {
            setError(errorMessage(err));
            setSlot(null);
            setReloadKey((k) => k + 1);
          } finally {
            setBusy(false);
          }
        }}
        className="mt-5 w-full rounded-xl bg-[#1a1a1a] py-3 font-bold text-white transition hover:bg-[#b98f42] disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Move viewing'}
      </button>
    </Dialog>
  );
}

function CancelDialog({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog title="Cancel this viewing?" onClose={onClose}>
      <p className="text-sm text-gray-600">
        {booking.property.title_en} · {dateTime(booking.startsAt)}
      </p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Reason (optional)</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#b98f42]" placeholder="e.g. Found another place" />
      </label>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-3 font-bold text-gray-700 hover:bg-gray-50">
          Keep it
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.del(`/portal/bookings/${booking.id}`, { reason: reason.trim() });
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
          className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? 'Cancelling…' : 'Cancel viewing'}
        </button>
      </div>
    </Dialog>
  );
}

function UpcomingCard({ b, locale, onReschedule, onCancel }: { b: Booking; locale: string; onReschedule: () => void; onCancel: () => void }) {
  const cover = b.property.images[0];
  const date = new Date(b.startsAt);
  return (
    <Card className="overflow-hidden">
      <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
        <Link href={`/${locale}/properties/${encodeURIComponent(b.property._id)}`} className="relative block h-40 bg-gray-100 md:h-full">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={b.property.title_en} className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
          )}
          <div className="absolute start-3 top-3 rounded-xl bg-white/95 px-3 py-2 text-center shadow">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#b98f42]">{date.toLocaleDateString('en-GB', { month: 'short', timeZone: TZ })}</p>
            <p className="text-2xl font-bold leading-none text-gray-900">{date.toLocaleDateString('en-GB', { day: 'numeric', timeZone: TZ })}</p>
          </div>
        </Link>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(b)}
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
              <Clock className="h-3.5 w-3.5" /> {countdown(b.startsAt)}
            </span>
          </div>
          <Link href={`/${locale}/properties/${encodeURIComponent(b.property._id)}`} className="mt-2 block text-lg font-bold text-gray-900 hover:text-[#b98f42]">
            {b.property.title_en}
          </Link>
          <p className="mt-1 text-sm font-semibold text-[#b98f42]">
            {date.toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ })} · 45 min
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 flex-none" /> {b.address}
          </p>
          {b.note && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm italic text-gray-600">“{b.note}”</p>}
          {b.awaitingConfirmation && (
            <p className="mt-2 text-xs text-amber-700">Your agent has been notified and will confirm this time shortly.</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            {b.agent && (
              <span className="me-auto flex items-center gap-2 text-sm text-gray-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#b98f42]/10 text-xs font-bold text-[#b98f42]">
                  {b.agent.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </span>
                {b.agent.name}
              </span>
            )}
            {b.agent?.phone && (
              <a href={`tel:${b.agent.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-[#b98f42]">
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
            )}
            {b.agent?.whatsapp && (
              <a href={`https://wa.me/${b.agent.whatsapp}?text=${encodeURIComponent(`Hello, about my viewing of ${b.property.reference_number}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:border-emerald-500">
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            <a href={b.directionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-[#b98f42]">
              <Navigation className="h-3.5 w-3.5" /> Directions
            </a>
            <a href={`${API_URL}/portal/bookings/${b.id}/calendar`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-[#b98f42]">
              <CalendarPlus className="h-3.5 w-3.5" /> Add to calendar
            </a>
          </div>
          {b.canChange && (
            <div className="mt-3 flex gap-4 text-xs font-bold">
              <button type="button" onClick={onReschedule} className="text-[#b98f42] hover:underline">
                Reschedule
              </button>
              <button type="button" onClick={onCancel} className="text-red-600 hover:underline">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function PortalBookingsPage() {
  const locale = useLocale();
  const state = usePortal<{ upcoming: Booking[]; past: Booking[] }>('/portal/bookings');
  const [reschedule, setReschedule] = useState<Booking | null>(null);
  const [cancel, setCancel] = useState<Booking | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const done = (message: string) => {
    setReschedule(null);
    setCancel(null);
    setFlash(message);
    state.reload();
  };

  return (
    <>
      <PageTitle
        title="My bookings"
        description="Viewings and home reservations — booked online or with your agent."
        actions={
          <Link href={`/${locale}/properties`} className="rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#b98f42]">
            Book another viewing
          </Link>
        }
      />
      {flash && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
          <CheckCircle2 className="h-4 w-4" /> {flash}
        </p>
      )}
      <ReservationsSection />
      <Section state={state}>
        {({ upcoming, past }) => (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">Upcoming</h2>
              {upcoming.length === 0 ? (
                <Card>
                  <Empty icon={CalendarClock} title="No upcoming viewings" description="Open any property and tap “Book a viewing” to pick a time that suits you." />
                </Card>
              ) : (
                <div className="space-y-4">
                  {upcoming.map((b) => (
                    <UpcomingCard key={b.id} b={b} locale={locale} onReschedule={() => setReschedule(b)} onCancel={() => setCancel(b)} />
                  ))}
                </div>
              )}
            </section>
            {past.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">History</h2>
                <Card className="divide-y divide-gray-100">
                  {past.map((b) => (
                    <div key={b.id} className={cn('flex flex-wrap items-center justify-between gap-3 p-4', b.status === 'CANCELLED' && 'opacity-60')}>
                      <div className="min-w-0">
                        <Link href={`/${locale}/properties/${encodeURIComponent(b.property._id)}`} className="font-bold text-gray-900 hover:text-[#b98f42]">
                          {b.property.title_en}
                        </Link>
                        <p className="text-sm text-gray-500">
                          {dateTime(b.startsAt)} · {b.property.reference_number}
                          {b.agent ? ` · ${b.agent.name}` : ''}
                        </p>
                      </div>
                      {statusBadge(b)}
                    </div>
                  ))}
                </Card>
              </section>
            )}
          </div>
        )}
      </Section>
      {reschedule && <RescheduleDialog booking={reschedule} onClose={() => setReschedule(null)} onDone={() => done('Viewing moved — your agent will confirm the new time.')} />}
      {cancel && <CancelDialog booking={cancel} onClose={() => setCancel(null)} onDone={() => done('Viewing cancelled. Your agent has been notified.')} />}
    </>
  );
}
