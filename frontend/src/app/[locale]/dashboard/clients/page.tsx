'use client';

import React, { useEffect, useState } from 'react';
import { Edit2, Mail, MoreVertical, Phone, Plus, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { CLIENT_TYPES, humanize } from '@/lib/shared/constants';
import type { ClientRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useClientsStore } from '@/store/crmStores';
import { AgentSelect } from '@/components/dashboard/pickers';
import { ClientDetailModal, ClientFormModal } from '@/components/dashboard/clients/ClientModals';
import {
  Badge,
  ConfirmDialog,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  formatDate,
  formatMoney,
  IconButton,
  PageHeader,
  Pagination,
  PrimaryButton,
  SearchInput,
  Table,
  TableState,
} from '@/components/dashboard/ui';

export default function ClientsPage() {
  const { items, meta, filters, loading, error, setFilters, setPage, fetch, remove } = useClientsStore();
  const can = useAuthStore((s) => s.can);
  const [form, setForm] = useState<{ client: ClientRow | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ClientRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await remove(deleting._id);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clients"
        subtitle="Tenants, buyers, landlords, sellers and investors you work with."
        actions={
          can('clients.create') && (
            <PrimaryButton onClick={() => setForm({ client: null })}>
              <Plus className="h-5 w-5" /> Add Client
            </PrimaryButton>
          )
        }
      />
      <ErrorBanner message={actionError} onClose={() => setActionError(null)} />

      <FilterBar>
        <SearchInput value={String(filters.q ?? '')} onChange={(q) => setFilters({ q })} placeholder="Search by name, phone, email..." />
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label="Type" value={String(filters.type ?? '')} onChange={(type) => setFilters({ type })}>
            <option value="">Type: All</option>
            {CLIENT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </FilterSelect>
          {can('clients.read_all') && (
            <div className="w-48">
              <AgentSelect
                value={String(filters.assigned_agent ?? '')}
                onChange={(id) => setFilters({ assigned_agent: id ?? '' })}
                emptyLabel="Agent: All"
                className="py-2 rounded-lg bg-white font-bold text-gray-600"
              />
            </div>
          )}
        </div>
      </FilterBar>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <Table headers={[{ label: 'Client' }, { label: 'Type' }, { label: 'Requirements' }, { label: 'Agent' }, { label: 'Added' }, { label: 'Actions', align: 'right' }]}>
          <TableState colSpan={6} loading={loading && items.length === 0} error={error} empty={!loading && items.length === 0} emptyText="No clients yet." />
          {items.map((client) => (
            <tr key={client._id} className="transition-all hover:bg-gray-50/50">
              <td className="px-6 py-6">
                <button type="button" onClick={() => setDetailId(client._id)} className="mb-1 text-left font-bold text-gray-900 hover:text-[#b98f42]">
                  {client.full_name}
                </button>
                {client.email && <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><Mail className="h-3 w-3" /> {client.email}</p>}
                {client.phone && <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><Phone className="h-3 w-3" /> {client.phone}</p>}
              </td>
              <td className="px-6 py-6">
                <div className="flex flex-wrap gap-1.5">
                  {client.types.map((t) => <Badge key={t} color="gold">{humanize(t)}</Badge>)}
                </div>
              </td>
              <td className="px-6 py-6 text-sm text-gray-600">
                <p className="max-w-[240px] truncate font-medium">
                  {client.preferred_locations.length ? client.preferred_locations.join(', ') : 'Any location'}
                </p>
                <p className="text-xs text-gray-400">
                  {client.budget_max ? `Up to ${formatMoney(client.budget_max, client.currency)}` : 'No budget set'}
                </p>
              </td>
              <td className="px-6 py-6 text-sm font-medium text-gray-700">{client.assigned_agent?.full_name ?? <span className="text-gray-400">Unassigned</span>}</td>
              <td className="px-6 py-6 text-sm text-gray-500">{formatDate(client.created_at)}</td>
              <td className="px-6 py-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  {can('clients.update') && (
                    <IconButton title="Edit" onClick={() => setForm({ client })}><Edit2 className="h-5 w-5" /></IconButton>
                  )}
                  {can('clients.delete') && (
                    <IconButton title="Delete" tone="danger" onClick={() => setDeleting(client)}><Trash2 className="h-5 w-5" /></IconButton>
                  )}
                  <IconButton title="Details" onClick={() => setDetailId(client._id)}><MoreVertical className="h-5 w-5" /></IconButton>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination meta={meta} noun="clients" onPage={setPage} />
      </div>

      {form && <ClientFormModal key={form.client?._id ?? 'new'} client={form.client} onClose={() => setForm(null)} />}
      {detailId && (
        <ClientDetailModal
          key={detailId}
          clientId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(client) => {
            setDetailId(null);
            setForm({ client });
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete client"
        message={`Delete ${deleting?.full_name}? Clients with deals or owned listings cannot be deleted.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
        busy={busy}
      />
    </div>
  );
}
