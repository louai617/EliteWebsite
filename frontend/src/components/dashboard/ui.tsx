'use client';

/**
 * Dashboard building blocks. Styles are lifted from the original dashboard
 * pages (cards, table, pagination, buttons) so new screens look identical.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Search, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PageMeta } from '@/lib/shared/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatMoney(value: number | null | undefined, currency = 'QAR'): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value).toLocaleString('en-US')} ${currency}`;
}

export function formatCompactMoney(value: number | null | undefined, currency = 'QAR'): string {
  if (value === null || value === undefined) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ${currency}`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K ${currency}`;
  return `${Math.round(value)} ${currency}`;
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return '';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

/** `<input type="datetime-local">` value for a date (local time). */
export function toLocalInput(value: string | Date | null | undefined, dateOnly = false): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return dateOnly ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/** Literal class strings so Tailwind keeps them in the build. */
const BADGE_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
  gold: 'bg-[#b98f42]/10 text-[#b98f42] border-[#b98f42]/30',
  black: 'bg-gray-900 text-white border-gray-900',
};
export const BADGE_COLOR_NAMES = Object.keys(BADGE_COLORS);

export function Badge({ color = 'gray', children, className }: { color?: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
        BADGE_COLORS[color] ?? BADGE_COLORS.gray,
        className
      )}
    >
      {children}
    </span>
  );
}

export const PRIORITY_COLORS: Record<string, string> = { low: 'gray', medium: 'blue', high: 'orange', urgent: 'red' };
export const PROPERTY_STATUS_COLORS: Record<string, string> = {
  available: 'green', reserved: 'amber', under_offer: 'purple', rented: 'blue', sold: 'emerald', off_market: 'gray',
};
export const VIEWING_STATUS_COLORS: Record<string, string> = {
  scheduled: 'blue', confirmed: 'purple', completed: 'emerald', cancelled: 'gray', no_show: 'red',
};
export const DEAL_STATUS_COLORS: Record<string, string> = {
  negotiation: 'orange', reserved: 'amber', contracted: 'purple', completed: 'emerald', cancelled: 'gray',
};

// ---------------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="font-medium tracking-tight text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-gray-100 bg-white shadow-sm', className)}>{children}</div>;
}

export function MiniStat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">{label}</p>
      <h3 className={cn('text-3xl font-bold text-gray-900', tone)}>{value}</h3>
    </div>
  );
}

export function PrimaryButton({ className, children, loading, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-[#b98f42] disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 font-bold text-gray-900 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  title,
  onClick,
  children,
  tone = 'default',
  disabled,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'gold' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-2 text-gray-400 transition-colors disabled:opacity-40',
        tone === 'gold' && 'hover:text-[#b98f42]',
        tone === 'danger' && 'hover:text-red-500',
        tone === 'default' && 'hover:text-gray-900'
      )}
    >
      {children}
    </button>
  );
}

export function ErrorBanner({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 border-l-4 border-red-500 bg-red-50 p-4" role="alert">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <p className="flex-1 text-sm font-medium text-red-700">{message}</p>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="text-red-400 hover:text-red-600">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Debounced search box in the dashboard filter-bar style. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in sync when the value changes from outside (e.g. "clear filters").
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className={cn('flex w-full items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 md:w-96', className)}>
      <Search className="h-5 w-5 text-gray-400" />
      <input
        type="search"
        value={text}
        placeholder={placeholder}
        maxLength={100}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(next.trim()), 350);
        }}
        className="w-full border-none bg-transparent text-sm text-gray-700 outline-none"
      />
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 outline-none transition-all hover:bg-gray-50"
    >
      {children}
    </select>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm xl:flex-row">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table + pagination (original dashboard markup)
// ---------------------------------------------------------------------------

export function Table({ headers, children }: { headers: { label: string; align?: 'right' }[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b border-gray-100 bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h.label}
                className={cn('px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400', h.align === 'right' && 'text-right')}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">{children}</tbody>
      </table>
    </div>
  );
}

export function TableState({ colSpan, loading, error, empty, emptyText }: {
  colSpan: number;
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText: string;
}) {
  if (!loading && !error && !empty) return null;
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16 text-center text-sm font-medium text-gray-400">
        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#b98f42]" />
        ) : error ? (
          <span className="text-red-500">{error}</span>
        ) : (
          emptyText
        )}
      </td>
    </tr>
  );
}

export function Pagination({ meta, noun, onPage }: { meta: PageMeta | null; noun: string; onPage: (page: number) => void }) {
  if (!meta) return null;
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const hasPrev = meta.page > 1;
  const hasNext = meta.page < meta.pages;
  const btn = (enabled: boolean) =>
    enabled
      ? 'px-4 py-2 border border-[#b98f42] bg-[#b98f42] rounded-lg text-sm font-bold text-white shadow-sm'
      : 'px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-400 cursor-not-allowed';
  return (
    <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-8 py-6">
      <p className="text-sm font-medium text-gray-500">
        Showing <span className="font-bold text-gray-900">{from}-{to}</span> of{' '}
        <span className="font-bold text-gray-900">{meta.total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={btn(hasPrev)} disabled={!hasPrev} onClick={() => onPage(meta.page - 1)}>
          Previous
        </button>
        <button type="button" className={btn(hasNext)} disabled={!hasNext} onClick={() => onPage(meta.page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal + form fields
// ---------------------------------------------------------------------------

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn('w-full rounded-2xl bg-white shadow-2xl', wide ? 'max-w-4xl' : 'max-w-2xl')}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-8 py-5">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-900">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-8 py-6">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-8 py-5">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onClose,
  busy,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={onConfirm} loading={busy} className="bg-red-600 hover:bg-red-700">
            {confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      <p className="text-gray-600">{message}</p>
    </Modal>
  );
}

export const inputClass =
  'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#b98f42]/20 focus:border-[#b98f42] outline-none transition-all text-sm';

export function Field({
  label,
  error,
  children,
  className,
  hint,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-12 shrink-0 cursor-pointer rounded-full transition-colors', checked ? 'bg-[#b98f42]' : 'bg-gray-200')}
    >
      <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', checked ? 'right-1' : 'left-1')} />
    </button>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 mt-2 text-sm font-bold uppercase tracking-wider text-[#b98f42]">{children}</h3>;
}
