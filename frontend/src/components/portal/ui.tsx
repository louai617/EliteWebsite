'use client';

import React from 'react';
import { AlertCircle, Inbox, Loader2, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';

export function cn(...inputs: (string | false | null | undefined)[]) {
  return clsx(inputs);
}

export const money = (amount: number, currency = 'QAR') =>
  new Intl.NumberFormat('en-QA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'Asia/Qatar' }).format(new Date(iso));

export const date = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'Asia/Qatar' }).format(new Date(iso));

export const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-gray-500 mt-1 text-sm">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm', className)}>{children}</div>;
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-gray-400" role="status">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4" role="alert">
      <AlertCircle className="w-8 h-8 text-red-500" />
      <p className="mt-3 text-sm text-gray-700 font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#b98f42] hover:underline">
          <RotateCcw className="w-4 h-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, description, icon: Icon = Inbox }: { title: string; description?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
        <Icon className="w-6 h-6" />
      </div>
      <p className="mt-3 font-bold text-gray-900">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>}
    </div>
  );
}

/** Loading → error → empty → content, in one place. */
export function Section<T>({ state, empty, children }: { state: { data: T | null; error: string | null; loading: boolean; reload: () => void }; empty?: (data: T) => React.ReactNode | null; children: (data: T) => React.ReactNode }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  const emptyNode = empty?.(state.data);
  return <>{emptyNode ?? children(state.data)}</>;
}

const TONES: Record<string, string> = {
  green: 'bg-green-50 text-green-700 border-green-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  gray: 'bg-gray-50 text-gray-600 border-gray-200',
  gold: 'bg-[#b98f42]/10 text-[#8a6a2f] border-[#b98f42]/20',
};

export function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: keyof typeof TONES }) {
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold', TONES[tone])}>{children}</span>;
}

export function statusTone(status: string): keyof typeof TONES {
  if (/COMPLETED|CLOSED_WON|SIGNED|AVAILABLE|Completed/.test(status)) return 'green';
  if (/SCHEDULED|IN_PROGRESS|PENDING|NEGOTIATION|progress|Negotiating|Viewing/.test(status)) return 'blue';
  if (/CANCELLED|LOST|NO_SHOW|Closed/.test(status)) return 'gray';
  if (/RESERVED|TODO|Received/.test(status)) return 'amber';
  return 'gray';
}
