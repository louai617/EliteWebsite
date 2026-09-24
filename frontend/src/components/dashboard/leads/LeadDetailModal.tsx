'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api, { apiErrorMessage } from '@/lib/api';
import { CLIENT_TYPES, humanize } from '@/lib/shared/constants';
import type { DealRow, LeadRow, TaskRow, ViewingRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useLeadsStore, useSettingsStore } from '@/store/crmStores';
import {
  Badge,
  DEAL_STATUS_COLORS,
  ErrorBanner,
  formatDate,
  formatMoney,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  VIEWING_STATUS_COLORS,
} from '../ui';

type LeadDetail = LeadRow & { viewings: ViewingRow[]; tasks: TaskRow[]; deals: DealRow[] };

/** Read-only lead view with related records and the convert-to-client action. */
export default function LeadDetailModal({
  leadId,
  onClose,
  onEdit,
}: {
  leadId: string | null;
  onClose: () => void;
  onEdit: (lead: LeadRow) => void;
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [types, setTypes] = useState<string[]>(['buyer']);
  const can = useAuthStore((s) => s.can);
  const statusLabel = useSettingsStore((s) => s.statusLabel);
  const statusColor = useSettingsStore((s) => s.statusColor);
  const sourceLabel = useSettingsStore((s) => s.sourceLabel);
  const typeLabel = useSettingsStore((s) => s.typeLabel);
  const refreshList = useLeadsStore((s) => s.fetch);

  // Mounted fresh (keyed by lead id) each time it opens.
  const load = useCallback((id: string) => {
    return api
      .get<{ data: LeadDetail }>(`/leads/${id}`)
      .then(({ data }) => {
        setLead(data.data);
        setTypes((current) => (data.data.purpose === 'rent' && current.includes('buyer') ? ['tenant'] : current));
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    if (leadId) void load(leadId);
  }, [leadId, load]);

  const convert = async () => {
    if (!lead) return;
    setConverting(true);
    setError(null);
    try {
      await api.post(`/leads/${lead._id}/convert`, { types });
      await load(lead._id);
      void refreshList();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setConverting(false);
    }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value || '—'}</dd>
    </div>
  );

  return (
    <Modal
      open={Boolean(leadId)}
      wide
      title={lead ? lead.full_name : 'Lead'}
      onClose={onClose}
      footer={
        lead && (
          <>
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
            {can('leads.update') && <PrimaryButton onClick={() => onEdit(lead)}>Edit Lead</PrimaryButton>}
          </>
        )
      }
    >
      <ErrorBanner message={error} />
      {!lead && !error && <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-[#b98f42]" />}
      {lead && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={statusColor(lead.status)}>{statusLabel(lead.status)}</Badge>
            <Badge>{sourceLabel(lead.source)}</Badge>
            <Badge color={lead.priority === 'urgent' ? 'red' : lead.priority === 'high' ? 'orange' : 'gray'}>{lead.priority} priority</Badge>
            {lead.tags.map((t) => <Badge key={t} color="gold">{t}</Badge>)}
          </div>

          <dl className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {row('Phone', lead.phone && <a className="hover:text-[#b98f42]" href={`tel:${lead.phone.replace(/\s+/g, '')}`}>{lead.phone}</a>)}
            {row('Email', lead.email && <a className="hover:text-[#b98f42]" href={`mailto:${lead.email}`}>{lead.email}</a>)}
            {row('WhatsApp', lead.whatsapp)}
            {row('Assigned agent', lead.assigned_agent?.full_name ?? 'Unassigned')}
            {row('Purpose', lead.purpose && (lead.purpose === 'sale' ? 'Buy' : 'Rent'))}
            {row('Property type', lead.property_type && typeLabel(lead.property_type))}
            {row('Location', lead.preferred_location)}
            {row('Budget', lead.budget_min || lead.budget_max ? `${formatMoney(lead.budget_min)} – ${formatMoney(lead.budget_max)}` : '')}
            {row('Bedrooms', lead.bedrooms)}
            {row('Next follow-up', lead.next_follow_up_at && formatDate(lead.next_follow_up_at, true))}
            {row('Last contact', lead.last_contact_at && formatDate(lead.last_contact_at, true))}
            {row('Created', formatDate(lead.created_at, true))}
          </dl>

          {lead.interested_properties.length > 0 && (
            <div>
              <SectionTitle>Interested properties</SectionTitle>
              <ul className="space-y-2 text-sm">
                {lead.interested_properties.map((p) => (
                  <li key={p._id} className="flex justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <span className="font-medium text-gray-900">{p.title_en}</span>
                    <span className="text-gray-400">{p.reference_number}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <SectionTitle>Client record</SectionTitle>
            {lead.client ? (
              <p className="text-sm text-gray-700">
                Linked to client <span className="font-bold">{lead.client.full_name}</span>
                {lead.client.types?.length ? ` (${lead.client.types.map(humanize).join(', ')})` : ''}.
              </p>
            ) : can('clients.create') ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {CLIENT_TYPES.map((t) => {
                    const on = types.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${on ? 'border-[#b98f42] bg-[#b98f42] text-white' : 'border-gray-200 text-gray-600'}`}
                      >
                        {humanize(t)}
                      </button>
                    );
                  })}
                </div>
                <PrimaryButton onClick={convert} loading={converting} disabled={types.length === 0} className="px-4 py-2 text-sm">
                  Convert to Client
                </PrimaryButton>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not linked to a client yet.</p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <SectionTitle>Viewings</SectionTitle>
              {lead.viewings.length === 0 && <p className="text-sm text-gray-400">None yet.</p>}
              <ul className="space-y-2 text-sm">
                {lead.viewings.map((v) => (
                  <li key={v._id} className="rounded-xl bg-gray-50 px-3 py-2">
                    <p className="font-medium text-gray-900">{v.property?.title_en}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{formatDate(v.scheduled_at, true)}</span>
                      <Badge color={VIEWING_STATUS_COLORS[v.status]}>{humanize(v.status)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionTitle>Tasks</SectionTitle>
              {lead.tasks.length === 0 && <p className="text-sm text-gray-400">None yet.</p>}
              <ul className="space-y-2 text-sm">
                {lead.tasks.map((t) => (
                  <li key={t._id} className="rounded-xl bg-gray-50 px-3 py-2">
                    <p className={`font-medium ${t.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</p>
                    <p className="text-xs text-gray-500">{t.due_at ? formatDate(t.due_at, true) : 'No due date'}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionTitle>Deals</SectionTitle>
              {lead.deals.length === 0 && <p className="text-sm text-gray-400">None yet.</p>}
              <ul className="space-y-2 text-sm">
                {lead.deals.map((d) => (
                  <li key={d._id} className="rounded-xl bg-gray-50 px-3 py-2">
                    <p className="font-medium text-gray-900">{d.property?.title_en}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{formatMoney(d.amount, d.currency)}</span>
                      <Badge color={DEAL_STATUS_COLORS[d.status]}>{humanize(d.status)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {(lead.notes || lead.message) && (
            <div>
              <SectionTitle>Notes</SectionTitle>
              {lead.message && <p className="mb-3 whitespace-pre-line rounded-xl bg-gray-50 p-4 text-sm text-gray-700">{lead.message}</p>}
              {lead.notes && <p className="whitespace-pre-line text-sm text-gray-700">{lead.notes}</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
