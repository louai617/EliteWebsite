'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Edit2,
  Trash2,
  Phone,
  Mail,
  MessageSquare,
  MoreVertical,
  Download,
} from 'lucide-react';
import api, { apiErrorMessage } from '@/lib/api';
import { PRIORITIES, humanize, type LeadStatusOption } from '@/lib/shared/constants';
import type { LeadRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useLeadsStore, useSettingsStore } from '@/store/crmStores';
import { AgentSelect } from '@/components/dashboard/pickers';
import LeadFormModal from '@/components/dashboard/leads/LeadFormModal';
import LeadDetailModal from '@/components/dashboard/leads/LeadDetailModal';
import {
  Badge,
  ConfirmDialog,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  formatMoney,
  IconButton,
  Pagination,
  SearchInput,
  Table,
  TableState,
} from '@/components/dashboard/ui';

const COUNT_TONES: Record<string, string> = {
  orange: 'text-orange-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
  red: 'text-red-600',
};

const AdminLeadsPage = () => {
  const { items, meta, filters, loading, error, setFilters, setPage, fetch, remove } = useLeadsStore();
  const settings = useSettingsStore((s) => s.settings);
  const statusLabel = useSettingsStore((s) => s.statusLabel);
  const statusColor = useSettingsStore((s) => s.statusColor);
  const sourceLabel = useSettingsStore((s) => s.sourceLabel);
  const can = useAuthStore((s) => s.can);

  const [summary, setSummary] = useState<(LeadStatusOption & { count: number })[]>([]);
  const [editing, setEditing] = useState<LeadRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LeadRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSummary = useCallback(() => {
    api
      .get<{ data: { by_status: (LeadStatusOption & { count: number })[] } }>('/leads/summary')
      .then(({ data }) => setSummary(data.data.by_status))
      .catch(() => setSummary([]));
  }, []);

  useEffect(() => {
    // The header search sends people here with ?q=
    const q = new URLSearchParams(window.location.search).get('q') ?? '';
    if (q !== (filters.q ?? '')) setFilters({ q });
    else void fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh the status cards whenever the list changes (create/edit/delete).
  useEffect(() => {
    if (!loading) loadSummary();
  }, [items, loading, loadSummary]);

  const exportCsv = () => {
    const params = new URLSearchParams(
      Object.entries(filters)
        .filter(([k, v]) => v !== undefined && v !== '' && k !== 'page' && k !== 'limit')
        .map(([k, v]) => [k, String(v)])
    );
    window.location.href = `/api/leads/export?${params.toString()}`;
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await remove(deleting._id);
      setDeleting(null);
    } catch (err) {
      setActionError(apiErrorMessage(err));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const contactHref = (lead: LeadRow) => {
    const number = (lead.whatsapp || lead.phone || '').replace(/\D/g, '');
    if (number) return `https://wa.me/${number}`;
    if (lead.email) return `mailto:${lead.email}`;
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Leads Management</h1>
          <p className="text-gray-500 font-medium tracking-tight">Track and manage all your property inquiries and leads.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportCsv}
            className="bg-white text-gray-900 px-6 py-3 rounded-xl font-bold border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          {can('leads.create') && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-[#b98f42] transition-all flex items-center gap-2 shadow-lg"
            >
              Add Manual Lead
            </button>
          )}
        </div>
      </div>

      <ErrorBanner message={actionError} onClose={() => setActionError(null)} />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {summary.slice(0, 4).map((status) => (
          <button
            type="button"
            key={status.key}
            onClick={() => setFilters({ status: filters.status === status.key ? '' : status.key })}
            className={`bg-white p-6 rounded-2xl border shadow-sm text-center transition-all ${filters.status === status.key ? 'border-[#b98f42]' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">{status.label}</p>
            <h3 className={`text-3xl font-bold ${COUNT_TONES[status.color] ?? 'text-gray-900'}`}>{status.count}</h3>
          </button>
        ))}
      </div>

      {/* Filters & Search */}
      <FilterBar>
        <SearchInput
          value={String(filters.q ?? '')}
          onChange={(q) => setFilters({ q })}
          placeholder="Search leads by name, email, phone..."
        />
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <FilterSelect label="Source" value={String(filters.source ?? '')} onChange={(source) => setFilters({ source })}>
            <option value="">Source: All</option>
            {settings?.lead_sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </FilterSelect>
          <FilterSelect label="Priority" value={String(filters.priority ?? '')} onChange={(priority) => setFilters({ priority })}>
            <option value="">Priority: All</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
          </FilterSelect>
          {can('leads.read_all') && (
            <div className="w-48">
              <AgentSelect
                value={String(filters.assigned_agent ?? '')}
                onChange={(id) => setFilters({ assigned_agent: id ?? '' })}
                emptyLabel="Agent: All"
                className="py-2 rounded-lg bg-white font-bold text-gray-600"
              />
            </div>
          )}
          <FilterSelect label="Status" value={String(filters.status ?? '')} onChange={(status) => setFilters({ status })}>
            <option value="">Status: All</option>
            {settings?.lead_statuses.map((s) => <option key={s.key} value={s.key}>Status: {s.label}</option>)}
          </FilterSelect>
        </div>
      </FilterBar>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <Table
          headers={[
            { label: 'Client Details' },
            { label: 'Property Inquired' },
            { label: 'Source & Status' },
            { label: 'Agent' },
            { label: 'Date' },
            { label: 'Actions', align: 'right' },
          ]}
        >
          <TableState colSpan={6} loading={loading && items.length === 0} error={error} empty={!loading && items.length === 0} emptyText="No leads match these filters." />
          {items.map((lead) => {
            const created = new Date(lead.created_at);
            const contact = contactHref(lead);
            return (
              <tr key={lead._id} className="hover:bg-gray-50/50 transition-all">
                <td className="px-6 py-6">
                  <div>
                    <button type="button" onClick={() => setViewingId(lead._id)} className="font-bold text-gray-900 mb-1 hover:text-[#b98f42] text-left">
                      {lead.full_name}
                    </button>
                    <div className="flex flex-col gap-1">
                      {lead.email && (
                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                          <Mail className="w-3 h-3" /> {lead.email}
                        </p>
                      )}
                      {lead.phone && (
                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                          <Phone className="w-3 h-3" /> {lead.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <p className="font-bold text-gray-700 mb-1 truncate max-w-[250px]">
                    {lead.interested_properties[0]?.title_en ?? (lead.preferred_location ? `Looking in ${lead.preferred_location}` : 'General enquiry')}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {lead.interested_properties.length > 1
                      ? `+${lead.interested_properties.length - 1} more properties`
                      : lead.budget_max
                        ? `Budget up to ${formatMoney(lead.budget_max)}`
                        : 'Inquiry regarding property'}
                  </p>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col gap-2">
                    <Badge color={statusColor(lead.status)}>{statusLabel(lead.status)}</Badge>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                      {lead.source === 'website_form' && <Mail className="w-3 h-3" />}
                      {lead.source === 'chatbot' && <MessageSquare className="w-3 h-3" />}
                      {lead.source === 'whatsapp' && <MessageSquare className="w-3 h-3 text-green-500" />}
                      {lead.source === 'call' && <Phone className="w-3 h-3" />}
                      {sourceLabel(lead.source)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-6 text-sm font-medium text-gray-700">
                  {lead.assigned_agent?.full_name ?? <span className="text-gray-400">Unassigned</span>}
                </td>
                <td className="px-6 py-6 whitespace-nowrap">
                  <p className="text-sm font-bold text-gray-900 mb-1">{created.toISOString().slice(0, 10)}</p>
                  <p className="text-xs text-gray-400 font-medium">{created.toTimeString().slice(0, 5)}</p>
                </td>
                <td className="px-6 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {contact && (
                      <a
                        href={contact}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-[#b98f42] transition-colors"
                        title="Contact"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </a>
                    )}
                    {can('leads.update') && (
                      <IconButton title="Edit" onClick={() => { setEditing(lead); setFormOpen(true); }}>
                        <Edit2 className="w-5 h-5" />
                      </IconButton>
                    )}
                    {can('leads.delete') && (
                      <IconButton title="Delete" tone="danger" onClick={() => setDeleting(lead)}>
                        <Trash2 className="w-5 h-5" />
                      </IconButton>
                    )}
                    <IconButton title="Details" onClick={() => setViewingId(lead._id)}>
                      <MoreVertical className="w-5 h-5" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
        <Pagination meta={meta} noun="leads" onPage={setPage} />
      </div>

      {formOpen && (
        <LeadFormModal key={editing?._id ?? 'new'} open lead={editing} onClose={() => setFormOpen(false)} />
      )}
      {viewingId && (
      <LeadDetailModal
        key={viewingId}
        leadId={viewingId}
        onClose={() => setViewingId(null)}
        onEdit={(lead) => {
          setViewingId(null);
          setEditing(lead);
          setFormOpen(true);
        }}
      />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete lead"
        message={`Delete ${deleting?.full_name}? Their open tasks are removed too. Leads with deals cannot be deleted — mark them as lost instead.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
        busy={busy}
      />
    </div>
  );
};

export default AdminLeadsPage;
