'use client';

import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { DEAL_STATUSES, DEAL_TYPES, humanize } from '@/lib/shared/constants';
import type { DealRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useDealsStore } from '@/store/crmStores';
import { AgentSelect, EntityPicker } from '@/components/dashboard/pickers';
import { cleanPayload, NumberInput, SelectInput, TextArea, TextInput, toIso, useCrmForm } from '@/components/dashboard/form';
import {
  ConfirmDialog,
  DEAL_STATUS_COLORS,
  ErrorBanner,
  Field,
  FilterBar,
  FilterSelect,
  formatCompactMoney,
  formatDate,
  formatMoney,
  IconButton,
  MiniStat,
  Modal,
  PageHeader,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  Table,
  TableState,
  toLocalInput,
} from '@/components/dashboard/ui';

const STATUS_TEXT: Record<string, string> = {
  orange: 'text-orange-700 bg-orange-50 border-orange-200',
  amber: 'text-amber-700 bg-amber-50 border-amber-200',
  purple: 'text-purple-700 bg-purple-50 border-purple-200',
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  gray: 'text-gray-700 bg-gray-50 border-gray-200',
};

function DealFormModal({ deal, onClose }: { deal: DealRow | null; onClose: () => void }) {
  const can = useAuthStore((s) => s.can);
  const create = useDealsStore((s) => s.create);
  const update = useDealsStore((s) => s.update);
  const form = useCrmForm({
    title: deal?.title ?? '',
    property: deal?.property?._id ?? '',
    client: deal?.client?._id ?? '',
    lead: deal?.lead?._id ?? '',
    assigned_agent: deal?.assigned_agent?._id ?? '',
    type: deal?.type ?? 'sale',
    status: deal?.status ?? 'negotiation',
    amount: deal?.amount ?? '',
    currency: deal?.currency ?? 'QAR',
    commission_percentage: deal?.commission_percentage ?? 2,
    commission_amount: '',
    deal_date: toLocalInput(deal?.deal_date ?? new Date(), true),
    notes: deal?.notes ?? '',
    documents: (deal?.documents ?? []).map((d) => `${d.name} | ${d.url}`).join('\n'),
  });
  const { values, errors } = form;
  const set = form.set as (key: string, value: unknown) => void;
  const common = { values, set, errors };

  const amount = Number(values.amount) || 0;
  const pct = Number(values.commission_percentage) || 0;

  const save = async () => {
    const payload: Record<string, unknown> = {
      ...cleanPayload(values, ['title', 'property', 'client', 'lead', 'type', 'status', 'amount', 'currency', 'commission_percentage', 'notes']),
      deal_date: toIso(values.deal_date),
      documents: String(values.documents)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, url] = line.includes('|') ? line.split('|').map((s) => s.trim()) : [line.split('/').pop() || 'Document', line];
          return { name, url };
        }),
    };
    if (values.commission_amount !== '') payload.commission_amount = values.commission_amount;
    if (can('deals.update_all') && values.assigned_agent) payload.assigned_agent = values.assigned_agent;
    const ok = await form.submit(() => (deal ? update(deal._id, payload) : create(payload)));
    if (ok) onClose();
  };

  return (
    <Modal
      open
      wide
      title={deal ? 'Edit Deal' : 'New Deal'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} loading={form.saving}>{deal ? 'Save Changes' : 'Create Deal'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-6">
        <ErrorBanner message={form.formError} />
        <p className="rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
          Marking a deal <b>Completed</b> sets the property to Sold/Rented and moves the linked lead to your first “won” status.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Property *" error={errors.property} className="md:col-span-3">
            <EntityPicker
              resource="properties"
              value={values.property || null}
              initial={deal ? { _id: deal.property._id, label: deal.property.title_en, sublabel: deal.property.reference_number } : null}
              placeholder="Search property…"
              onChange={(id) => set('property', id ?? '')}
            />
          </Field>
          <Field label="Client" error={errors.client}>
            <EntityPicker
              resource="clients"
              value={values.client || null}
              initial={deal?.client ? { _id: deal.client._id, label: deal.client.full_name } : null}
              placeholder="Search clients…"
              onChange={(id) => set('client', id ?? '')}
            />
          </Field>
          <Field label="Lead" error={errors.lead}>
            <EntityPicker
              resource="leads"
              value={values.lead || null}
              initial={deal?.lead ? { _id: deal.lead._id, label: deal.lead.full_name } : null}
              placeholder="Search leads…"
              onChange={(id) => set('lead', id ?? '')}
            />
          </Field>
          {can('deals.update_all') ? (
            <Field label="Agent">
              <AgentSelect value={values.assigned_agent} emptyLabel="Me" onChange={(id) => set('assigned_agent', id ?? '')} />
            </Field>
          ) : (
            <div />
          )}
          <TextInput name="title" label="Title" placeholder="Optional" {...common} />
          <SelectInput name="type" label="Type" options={DEAL_TYPES.map((t) => ({ value: t, label: humanize(t) }))} {...common} />
          <SelectInput name="status" label="Status" options={DEAL_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} {...common} />
          <NumberInput name="amount" label={values.type === 'rental' ? 'Contract rent' : 'Sale price'} required {...common} />
          <NumberInput name="commission_percentage" label="Commission %" step={0.1} {...common} />
          <NumberInput
            name="commission_amount"
            label="Commission amount"
            hint={`Auto: ${formatMoney(Math.round((amount * pct) / 100), String(values.currency))}`}
            {...common}
          />
          <TextInput name="currency" label="Currency" {...common} />
          <TextInput name="deal_date" label="Deal date" type="date" {...common} />
          <div />
          <TextArea name="documents" label="Documents (one per line: Name | https://…)" className="md:col-span-3" rows={2} {...common} />
          <TextArea name="notes" label="Notes" className="md:col-span-3" {...common} />
        </div>
      </div>
    </Modal>
  );
}

export default function DealsPage() {
  const { items, meta, filters, loading, error, setFilters, setPage, fetch, remove, update } = useDealsStore();
  const can = useAuthStore((s) => s.can);
  const [form, setForm] = useState<{ deal: DealRow | null } | null>(null);
  const [deleting, setDeleting] = useState<DealRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const totals = (meta?.totals as { amount: number; commission: number } | undefined) ?? { amount: 0, commission: 0 };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Deals"
        subtitle="Sales and rentals from negotiation to completion."
        actions={
          can('deals.create') && (
            <PrimaryButton onClick={() => setForm({ deal: null })}>
              <Plus className="h-5 w-5" /> New Deal
            </PrimaryButton>
          )
        }
      />
      <ErrorBanner message={actionError} onClose={() => setActionError(null)} />

      <div className="grid gap-6 md:grid-cols-3">
        <MiniStat label="Deals (filtered)" value={meta?.total ?? 0} />
        <MiniStat label="Total value" value={formatCompactMoney(totals.amount)} />
        <MiniStat label="Commission" value={formatCompactMoney(totals.commission)} />
      </div>

      <FilterBar>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label="Status" value={String(filters.status ?? '')} onChange={(status) => setFilters({ status })}>
            <option value="">Status: All</option>
            {DEAL_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </FilterSelect>
          <FilterSelect label="Type" value={String(filters.type ?? '')} onChange={(type) => setFilters({ type })}>
            <option value="">Sale & Rental</option>
            {DEAL_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </FilterSelect>
          {can('deals.read_all') && (
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
        <FilterSelect label="Sort" value={String(filters.sort ?? '-created_at')} onChange={(sort) => setFilters({ sort })}>
          <option value="-created_at">Sort by: Newest</option>
          <option value="-deal_date">Sort by: Deal date</option>
          <option value="-amount">Sort by: Amount</option>
          <option value="-commission_amount">Sort by: Commission</option>
        </FilterSelect>
      </FilterBar>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <Table headers={[{ label: 'Property' }, { label: 'Client' }, { label: 'Amount' }, { label: 'Commission' }, { label: 'Status' }, { label: 'Agent' }, { label: 'Actions', align: 'right' }]}>
          <TableState colSpan={7} loading={loading && items.length === 0} error={error} empty={!loading && items.length === 0} emptyText="No deals yet." />
          {items.map((d) => (
            <tr key={d._id} className="transition-all hover:bg-gray-50/50">
              <td className="px-6 py-6">
                <p className="max-w-[220px] truncate font-bold text-gray-900">{d.title || d.property?.title_en}</p>
                <p className="text-xs font-bold tracking-wider text-gray-400">{d.property?.reference_number} · {humanize(d.type)} · {formatDate(d.deal_date)}</p>
              </td>
              <td className="px-6 py-6 text-sm font-medium text-gray-700">{d.client?.full_name ?? d.lead?.full_name ?? '—'}</td>
              <td className="px-6 py-6 text-sm font-bold text-gray-900">{formatMoney(d.amount, d.currency)}</td>
              <td className="px-6 py-6 text-sm">
                <p className="font-bold text-gray-900">{formatMoney(d.commission_amount, d.currency)}</p>
                {d.commission_percentage != null && <p className="text-xs text-gray-400">{d.commission_percentage}%</p>}
              </td>
              <td className="px-6 py-6">
                <select
                  aria-label="Deal status"
                  value={d.status}
                  disabled={!can('deals.update')}
                  onChange={async (e) => {
                    try {
                      await update(d._id, { status: e.target.value });
                    } catch (err) {
                      setActionError(apiErrorMessage(err));
                    }
                  }}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider outline-none ${STATUS_TEXT[DEAL_STATUS_COLORS[d.status]] ?? STATUS_TEXT.gray}`}
                >
                  {DEAL_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                </select>
              </td>
              <td className="px-6 py-6 text-sm font-medium text-gray-700">{d.assigned_agent?.full_name}</td>
              <td className="px-6 py-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  {can('deals.update') && <IconButton title="Edit" onClick={() => setForm({ deal: d })}><Edit2 className="h-5 w-5" /></IconButton>}
                  {can('deals.delete') && <IconButton title="Delete" tone="danger" onClick={() => setDeleting(d)}><Trash2 className="h-5 w-5" /></IconButton>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination meta={meta} noun="deals" onPage={setPage} />
      </div>

      {form && <DealFormModal key={form.deal?._id ?? 'new'} deal={form.deal} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete deal"
        message="Delete this deal? Consider setting it to Cancelled to keep the history."
        onConfirm={async () => {
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
        }}
        onClose={() => setDeleting(null)}
        busy={busy}
      />
    </div>
  );
}
