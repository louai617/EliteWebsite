'use client';

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Loader2, Upload } from 'lucide-react';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { BankDetails } from '@/lib/api-types';

function CopyRow({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  const t = useTranslations('reserve');
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-0">
      <span className="w-36 flex-none text-xs text-gray-500">{label}</span>
      <span className={`min-w-0 flex-1 break-all text-sm font-bold text-gray-900 ${mono ? 'font-mono' : ''}`} dir="ltr">
        {value}
      </span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard?.writeText(value).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="flex-none rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-800"
        aria-label={`${t('copy')} ${label}`}
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Where and how to pay a reservation deposit (Fawran / bank transfer), with copy buttons. */
export function PaymentDetails({ reference, amount, bank }: { reference: string; amount: string; bank: BankDetails }) {
  const t = useTranslations('reserve');
  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <CopyRow label={t('amount')} value={amount} />
      <CopyRow label={t('reference')} value={reference} mono />
      <CopyRow label={t('fawran_alias')} value={bank.fawranAlias} mono />
      <CopyRow label={t('bank')} value={bank.bankName} />
      <CopyRow label={t('account_name')} value={bank.accountName} />
      <CopyRow label={t('iban')} value={bank.iban} mono />
      <CopyRow label={t('account_number')} value={bank.accountNumber} mono />
      <CopyRow label={t('swift')} value={bank.swift} mono />
      {bank.instructions && <p className="px-4 py-3 text-xs text-gray-500">{bank.instructions}</p>}
    </div>
  );
}

/** Upload the Fawran / transfer receipt for a reservation. */
export function ReceiptUpload({ reservationId, onDone }: { reservationId: string; onDone?: () => void }) {
  const t = useTranslations('reserve');
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const upload = async (file: File) => {
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set('kind', 'PROOF_OF_PAYMENT');
    form.set('reservationId', reservationId);
    form.set('file', file);
    try {
      await api.upload('/portal/documents', form);
      setMessage({ ok: true, text: t('receipt_uploaded') });
      onDone?.();
    } catch (err) {
      setMessage({ ok: false, text: (err instanceof ApiError && err.fields?.file?.[0]) || errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? t('uploading') : t('upload_receipt')}
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
      {message && (
        <p className={`mt-2 text-sm ${message.ok ? 'text-emerald-700' : 'text-red-600'}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
