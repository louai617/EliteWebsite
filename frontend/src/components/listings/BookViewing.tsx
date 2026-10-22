'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarCheck, CalendarDays, CalendarPlus, Loader2, MapPin, X } from 'lucide-react';
import SlotPicker from './SlotPicker';
import GuestDetails, { contactProblem, EMPTY_CONTACT, type GuestContact } from './GuestDetails';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { GuestBooking } from '@/lib/api-types';

const TZ = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'Asia/Qatar';

const icsDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** A downloadable calendar entry for the booked viewing (made in the browser). */
function calendarFile(b: GuestBooking) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ELITE Real Estate//Website//EN',
    'BEGIN:VEVENT',
    `UID:viewing-${b.reference}-${icsDate(b.startsAt)}@eliterealestate.qa`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(b.startsAt)}`,
    `DTEND:${icsDate(b.endsAt)}`,
    `SUMMARY:${icsText(`Viewing: ${b.title}`)}`,
    `LOCATION:${icsText(b.address)}`,
    `DESCRIPTION:${icsText(`Reference ${b.reference}${b.agent ? `\nAgent: ${b.agent.name}${b.agent.phone ? ` (${b.agent.phone})` : ''}` : ''}\nDirections: ${b.directionsUrl}`)}`,
    'STATUS:TENTATIVE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
}

/**
 * Book a viewing on a listing — no account needed. The visitor picks a free time and leaves
 * their name, phone and e-mail; the booking goes straight into the agent app as a viewing on
 * a website lead, and the agent confirms it (the visitor is e-mailed both times).
 */
export default function BookViewing({ reference, agentName, variant = 'primary', className = '' }: { reference: string; agentName: string; variant?: 'primary' | 'compact'; className?: string }) {
  const t = useTranslations('booking');
  const tg = useTranslations('guest');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [note, setNote] = useState('');
  const [contact, setContact] = useState<GuestContact>(EMPTY_CONTACT);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<GuestBooking | null>(null);
  const [icsUrl, setIcsUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => () => {
    if (icsUrl) URL.revokeObjectURL(icsUrl);
  }, [icsUrl]);

  const book = async () => {
    if (!slot) return;
    const problem = contactProblem(contact);
    if (problem) {
      setFieldErrors({ [problem]: [tg(`invalid_${problem}`)] });
      return;
    }
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api.post<GuestBooking>('/public/viewings', {
        property: reference, startsAt: slot, note: note.trim(),
        name: contact.name.trim(), phone: contact.phone.trim(), email: contact.email.trim(), website: contact.website,
      });
      setBooked(res);
      if (res.endsAt) setIcsUrl(calendarFile(res));
    } catch (err) {
      setError(errorMessage(err, t('error')));
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      // A slot may have just been taken: reload the times.
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setSlot(null);
        setReloadKey((k) => k + 1);
      }
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

            {booked ? (
              <div className="rounded-2xl bg-emerald-50 p-6 text-center">
                <CalendarCheck className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
                <p className="mt-3 text-lg font-bold text-secondary">{t('success_title')}</p>
                <p className="mt-1 font-medium text-emerald-800">{when(booked.startsAt)}</p>
                <p className="mt-2 text-sm text-gray-600">{t('success_body', { agent: booked.agent?.name ?? agentName })}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {icsUrl && (
                    <a href={icsUrl} download={`viewing-${booked.reference}.ics`} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
                      <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                      {t('add_calendar')}
                    </a>
                  )}
                  <a href={booked.directionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-secondary hover:border-primary">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {t('directions')}
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

                <div className="mt-5">
                  <GuestDetails value={contact} onChange={(c) => { setContact(c); setFieldErrors({}); }} fieldErrors={fieldErrors} />
                </div>

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
