'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Download, Eye, FileJson, FileText, ImageIcon, ShieldCheck, Upload } from 'lucide-react';
import { api, ApiError, documentUrl, errorMessage } from '@/lib/api';
import type { ClientDocumentKind, PortalDocument } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Card, cn, date, Empty, PageTitle, Section } from '@/components/portal/ui';

const KIND_LABEL: Record<ClientDocumentKind, string> = {
  QID: 'QID',
  PASSPORT: 'Passport',
  VISA: 'Visa / residence permit',
  TRADE_LICENSE: 'Trade licence (CR)',
  PROOF_OF_PAYMENT: 'Payment receipt',
  CONTRACT: 'Signed contract',
  BOOKING_FORM: 'Booking form',
  OTHER: 'Other',
};
const UPLOAD_KINDS: ClientDocumentKind[] = ['QID', 'PASSPORT', 'VISA', 'TRADE_LICENSE', 'PROOF_OF_PAYMENT', 'OTHER'];
const ID_KINDS: ClientDocumentKind[] = ['QID', 'PASSPORT', 'VISA', 'TRADE_LICENSE'];
const input = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-[#b98f42] focus:ring-2 focus:ring-[#b98f42]/20';

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UploadCard({ onUploaded }: { onUploaded: () => void }) {
  const [kind, setKind] = useState<ClientDocumentKind>('QID');
  const [file, setFile] = useState<File | null>(null);
  const [number, setNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isId = ID_KINDS.includes(kind);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setStatus(null);
    const form = new FormData();
    form.set('kind', kind);
    form.set('file', file);
    if (isId && number) form.set('number', number);
    if (isId && expiresAt) form.set('expiresAt', expiresAt);
    if (!isId && title) form.set('title', title);
    try {
      await api.upload('/portal/documents', form);
      setStatus({ ok: true, text: `${KIND_LABEL[kind]} uploaded. Your agent can see it now.` });
      setFile(null);
      setNumber('');
      setExpiresAt('');
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      onUploaded();
    } catch (err) {
      setStatus({ ok: false, text: (err instanceof ApiError && err.fields?.file?.[0]) || errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="font-bold text-gray-900">Upload a document</h2>
      <p className="mt-1 text-sm text-gray-500">PDF or a clear photo (JPG, PNG), up to 10 MB. Only you and your ELITE agent can open it.</p>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as ClientDocumentKind)} className={input}>
            {UPLOAD_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">File</span>
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={cn(input, 'cursor-pointer py-2')} />
        </label>
        {isId ? (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Document number</span>
              <input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} className={input} placeholder={kind === 'QID' ? 'e.g. 28463400000' : ''} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Expiry date</span>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={input} />
            </label>
          </>
        ) : (
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Description (optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={input} />
          </label>
        )}
        {status && (
          <p className={cn('flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium sm:col-span-2', status.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')} role="status">
            {status.ok && <CheckCircle2 className="h-4 w-4" />}
            {status.text}
          </p>
        )}
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy || !file} className="inline-flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#b98f42] disabled:opacity-50">
            <Upload className="h-4 w-4" /> {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function ExportCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api.get<unknown>('/portal/data');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elite-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, "We couldn't prepare your data. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-6">
      <FileJson className="h-8 w-8 text-[#b98f42]" />
      <h2 className="mt-3 font-bold text-gray-900">Download your data</h2>
      <p className="mt-1 text-sm text-gray-500">A complete export of your profile, saved homes, viewings, enquiries, tasks and deals (JSON).</p>
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button onClick={download} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#b98f42] disabled:opacity-50">
        <Download className="h-4 w-4" /> {busy ? 'Preparing…' : 'Download (JSON)'}
      </button>
    </Card>
  );
}

/** Documents & data: ID documents for the agent, contracts and receipts, plus the data export. */
export default function PortalDocumentsPage() {
  const state = usePortal<PortalDocument[]>('/portal/documents');
  return (
    <>
      <PageTitle title="Documents" description="Your ID documents, receipts and contracts — shared securely with your ELITE agent." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Section
            state={state}
            empty={(docs) =>
              docs.length === 0 ? (
                <Card>
                  <Empty icon={ShieldCheck} title="No documents yet" description="Upload your QID or passport so your agent can prepare your booking and contract faster." />
                </Card>
              ) : null
            }
          >
            {(docs) => (
              <Card className="divide-y divide-gray-100">
                {docs.map((d) => {
                  const Icon = d.mimeType === 'application/pdf' ? FileText : ImageIcon;
                  const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
                  return (
                    <div key={d.id} className="flex items-center gap-4 p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b98f42]/10 text-[#b98f42]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900">
                          {KIND_LABEL[d.kind] ?? d.kind}
                          {d.number && <span className="ms-2 font-mono text-xs font-normal text-gray-500">{d.number}</span>}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {d.title ?? d.fileName} · {size(d.size)} · {date(d.createdAt)}
                          {d.uploadedByClient ? ' · uploaded by you' : ' · from your agent'}
                          {d.expiresAt && <span className={expired ? 'text-red-600' : ''}> · {expired ? 'expired' : 'valid until'} {date(d.expiresAt)}</span>}
                        </p>
                      </div>
                      <a href={documentUrl(d.id)} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label={`Open ${d.fileName}`}>
                        <Eye className="h-4 w-4" />
                      </a>
                      <a href={documentUrl(d.id, true)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label={`Download ${d.fileName}`}>
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  );
                })}
              </Card>
            )}
          </Section>
          <UploadCard onUploaded={state.reload} />
        </div>
        <ExportCard />
      </div>
    </>
  );
}
