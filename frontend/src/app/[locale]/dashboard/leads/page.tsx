'use client';

import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { PortalLead } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Badge, Card, date, Empty, money, PageTitle, Section, statusTone } from '@/components/portal/ui';

function EnquiryForm({ onSent }: { onSent: () => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const text = message.trim();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.length < 5) return setError('Please write at least a few words.');
        setBusy(true);
        setError(null);
        try {
          await api.post('/portal/enquiries', { message: text });
          setMessage('');
          setSent(true);
          onSent();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <textarea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setSent(false);
        }}
        rows={4}
        maxLength={2000}
        placeholder="e.g. Looking for a 3-bedroom apartment in Lusail, up to QAR 15,000 per month."
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#b98f42]/20 focus:border-[#b98f42] outline-none text-sm"
        aria-label="Your request"
      />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {sent && <p className="text-sm text-green-700" role="status">Sent — your agent will be in touch.</p>}
      <button type="submit" disabled={busy || !text} className="inline-flex items-center gap-2 bg-[#1a1a1a] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#b98f42] transition-colors disabled:opacity-50">
        <Send className="w-4 h-4" /> {busy ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}

export default function PortalLeadsPage() {
  const state = usePortal<PortalLead[]>('/portal/leads');
  return (
    <>
      <PageTitle title="My enquiries" description="Requests you have sent us and where each one stands." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-2 sm:p-4">
          <Section state={state} empty={(rows) => (rows.length === 0 ? <Empty icon={MessageSquare} title="No enquiries yet" description="Send us a request and an agent will follow up." /> : null)}>
            {(rows) => (
              <ul className="divide-y divide-gray-100">
                {rows.map((l) => (
                  <li key={l.id} className="p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-gray-900">
                        {l.purpose ? (l.purpose === 'RENT' ? 'To rent' : 'To buy') : 'Enquiry'}
                        {l.interestedArea ? ` · ${l.interestedArea}` : ''}
                      </p>
                      <Badge tone={statusTone(l.stage)}>{l.stage}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Sent {date(l.createdAt)}
                      {l.bedrooms != null && ` · ${l.bedrooms === 0 ? 'Studio' : `${l.bedrooms} bedrooms`}`}
                      {(l.budgetMin != null || l.budgetMax != null) && ` · Budget ${l.budgetMin != null ? money(l.budgetMin) : 'any'} – ${l.budgetMax != null ? money(l.budgetMax) : 'any'}`}
                      {l.agent && ` · Agent: ${l.agent.name}`}
                    </p>
                    {l.properties.length > 0 && <p className="text-xs text-gray-400 mt-1">{l.properties.map((p) => `${p.reference} ${p.title}`).join(' · ')}</p>}
                    {!l.closed && l.stage === 'Received' && <p className="text-xs text-gray-400 mt-1">Waiting for first contact from your agent</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Card>
        <Card className="p-6 self-start">
          <h2 className="font-bold text-gray-900 mb-1">New request</h2>
          <p className="text-sm text-gray-500 mb-4">Tell us what you need — it goes straight to your agent.</p>
          <EnquiryForm onSent={state.reload} />
        </Card>
      </div>
    </>
  );
}
