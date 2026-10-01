'use client';

import { useState } from 'react';
import { Download, FileJson, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Card, PageTitle } from '@/components/portal/ui';

/** "My data": download everything ELITE holds about the client account (JSON). */
export default function PortalDocumentsPage() {
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
    <>
      <PageTitle title="My data" description="Documents and the information we hold about you." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <FileJson className="w-8 h-8 text-[#b98f42]" />
          <h2 className="font-bold text-gray-900 mt-3">Download your data</h2>
          <p className="text-sm text-gray-500 mt-1">A complete export of your profile, shortlisted properties, viewings, enquiries, tasks and deals in JSON format.</p>
          {error && <p className="text-sm text-red-600 mt-3" role="alert">{error}</p>}
          <button onClick={download} disabled={busy} className="mt-5 inline-flex items-center gap-2 bg-[#1a1a1a] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#b98f42] transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> {busy ? 'Preparing…' : 'Download (JSON)'}
          </button>
        </Card>
        <Card className="p-6">
          <ShieldCheck className="w-8 h-8 text-[#b98f42]" />
          <h2 className="font-bold text-gray-900 mt-3">Contracts and documents</h2>
          <p className="text-sm text-gray-500 mt-1">
            Signed contracts, receipts and ID copies are handled directly by your agent and are not stored in the portal. Ask your agent for a copy of any document related to your deals.
          </p>
        </Card>
      </div>
    </>
  );
}
