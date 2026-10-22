'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export interface GuestContact {
  name: string;
  phone: string;
  email: string;
  /** Honeypot: hidden from people, bots fill it. */
  website: string;
}

export const EMPTY_CONTACT: GuestContact = { name: '', phone: '', email: '', website: '' };

const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Quick client-side check (the server validates again). Returns the first problem, if any. */
export function contactProblem(c: GuestContact): 'name' | 'phone' | 'email' | null {
  if (c.name.trim().length < 2) return 'name';
  if (!PHONE.test(c.phone.trim())) return 'phone';
  if (!EMAIL.test(c.email.trim())) return 'email';
  return null;
}

/** Name, phone and e-mail for viewing bookings and reservations (no account needed). */
export default function GuestDetails({ value, onChange, fieldErrors }: { value: GuestContact; onChange: (next: GuestContact) => void; fieldErrors?: Record<string, string[] | undefined> }) {
  const t = useTranslations('guest');
  const field = (key: 'name' | 'phone' | 'email', type: string, autoComplete: string, placeholder?: string) => {
    const error = fieldErrors?.[key]?.[0];
    return (
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t(key)}</span>
        <input
          type={type}
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={key === 'email' ? 160 : key === 'name' ? 120 : 24}
          dir={key === 'name' ? undefined : 'ltr'}
          aria-invalid={Boolean(error)}
          className={`w-full rounded-xl border bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary ${error ? 'border-red-300' : 'border-gray-200'}`}
        />
        {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      </label>
    );
  };
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-bold text-secondary">{t('title')}</legend>
      {field('name', 'text', 'name')}
      <div className="grid gap-3 sm:grid-cols-2">
        {field('phone', 'tel', 'tel', '+974 5512 3456')}
        {field('email', 'email', 'email', 'name@example.com')}
      </div>
      <p className="text-xs text-gray-500">{t('privacy')}</p>
      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={value.website} onChange={(e) => onChange({ ...value, website: e.target.value })} className="hidden" />
    </fieldset>
  );
}
