'use client';

import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { VIEWING_STATUSES, humanize } from '@/lib/shared/constants';
import type { ViewingRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useViewingsStore } from '@/store/crmStores';
import { AgentSelect, EntityPicker } from '@/components/dashboard/pickers';
import { cleanPayload, NumberInput, SelectInput, TextArea, TextInput, toIso, useCrmForm } from '@/components/dashboard/form';
import {
  ConfirmDialog,
  ErrorBanner,
  Field,
  FilterBar,
  FilterSelect,
  formatDate,
  formatTime,
  IconButton,
  Modal,
  PageHeader,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  Table,
  TableState,
  toLocalInput,
  VIEWING_STATUS_COLORS,
} from '@/components/dashboard/ui';

const STATUS_TEXT: Record<string, string> = {
  blue: 'text-blue-700 bg-blue-50 border-blue-200',
  purple: 'text-purple-700 bg-purple-50 border-purple-200',
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  gray: 'text-gray-700 bg-gray-50 border-gray-200',
  red: 'text-red-700 bg-red-50 border-red-200',
};

function ViewingFormModal({ viewing, onClose }: { viewing: ViewingRow | null; onClose: () => void }) {
  const can = useAuthStore((s) => s.can);
  const create = useViewingsStore((s) => s.create);
  const update = useViewingsStore((s) => s.update);
  const form = useCrmForm({
    property: viewing?.property?._id ?? '',
    lead: viewing?.lead?._id ?? '',
    client: viewing?.client?._id ?? '',
    assigned_agent: viewing?.assigned_agent?._id ?? '',
    scheduled_at: toLocalInput(viewing?.scheduled_at),
    duration_minutes: viewing?.duration_minutes ?? 30,
    status: viewing?.status ?? 'scheduled',
    reminder_minutes: viewing?.reminder_minutes ?? 60,
    notes: viewing?.notes ?? '',
    feedback: viewing?.feedback ?? '',
    rating: viewing?.rating ?? '',
  });
  const { values, errors } = form;
  const set = form.set as (key: string, value: unknown) => void;
  const common = { values, set, errors };

  const save = async () => {
    const payload: Record<string, unknown> = {
      ...cleanPayload(values, ['property', 'lead', 'client', 'duration_minutes', 'status', 'reminder_minutes', 'notes', 'feedback', 'rating']),
      scheduled_at: toIso(values.scheduled_at),
    };
    if (can('viewings.update_all') && values.assigned_agent) payload.assigned_agent = values.assigned_agent;
    const ok = await form.submit(() => (viewing ? update(viewing._id, payload) : create(payload)));
    if (ok) onClose();
  };

  return (
    <Modal
      open
      wide
      title={viewing ? 'Edit Viewing' : 'Schedule Viewing'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} loading={form.saving}>{viewing ? 'Save Changes' : 'Schedule'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-6">
        <ErrorBanner message={form.formError} />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Property *" error={errors.property} className="md:col-span-3">
            <EntityPicker
              resource="properties"
              value={values.property || null}
              initial={viewing ? { _id: viewing.property._id, label: viewing.property.title_en, sublabel: viewing.property.reference_number } : null}
              placeholder="Search property by title or reference…"
              onChange={(id) => set('property', id ?? '')}
            />
          </Field>
          <Field label="Lead" error={errors.lead}>
            <EntityPicker
              resource="leads"
              value={values.lead || null}
              initial={viewing?.lead ? { _id: viewing.lead._id, label: viewing.lead.full_name } : null}
              placeholder="Search leads…"
              onChange={(id) => set('lead', id ?? '')}
            />
          </Field>
          <Field label="Client" error={errors.client}>
            <EntityPicker
              resource="clients"
              value={values.client || null}
              initial={viewing?.client ? { _id: viewing.client._id, label: viewing.client.full_name } : null}
              placeholder="Search clients…"
              onChange={(id) => set('client', id ?? '')}
            />
          </Field>
          {can('viewings.update_all') ? (
            <Field label="Agent" error={errors.assigned_agent}>
              <AgentSelect value={values.assigned_agent} allowEmpty emptyLabel="Me" onChange={(id) => set('assigned_agent', id ?? '')} />
            </Field>
          ) : (
            <div />
          )}
          <TextInput name="scheduled_at" label="Date & time" type="datetime-local" required {...common} />
          <NumberInput name="duration_minutes" label="Duration (min)" min={5} {...common} />
          <SelectInput name="status" label="Status" options={VIEWING_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} {...common} />
          <SelectInput
            name="reminder_minutes"
            label="Reminder"
            emptyLabel="No reminder"
            options={[
              { value: '15', label: '15 minutes before' },
              { value: '60', label: '1 hour before' },
              { value: '180', label: '3 hours before' },
              { value: '1440', label: '1 day before' },
            ]}
            {...common}
          />
          <SelectInput name="rating" label="Client rating" emptyLabel="—" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: '★'.repeat(n) }))} {...common} />
          <div />
          <TextArea name="notes" label="Notes" className="md:col-span-3" {...common} />
          <TextArea name="feedback" label="Feedback after viewing" className="md:col-span-3" {...common} />
        </div>
      </div>
    </Modal>
  );
}

export default function ViewingsPage() {
  const { items, meta, filters, loading, error, setFilters, setPage, fetch, remove, update } = useViewingsStore();
  const can = useAuthStore((s) => s.can);
  const [form, setForm] = useState<{ viewing: ViewingRow | null } | null>(null);
  const [deleting, setDeleting] = useState<ViewingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const setStatus = async (viewing: ViewingRow, status: string) => {
    try {
      await update(viewing._id, { status });
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const view = filters.upcoming ? 'upcoming' : filters.sort === '-scheduled_at' ? 'past' : 'all';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Viewings"
        subtitle="Property viewing appointments with leads and clients."
        actions={
          can('viewings.create') && (
            <PrimaryButton onClick={() => setForm({ viewing: null })}>
              <Plus className="h-5 w-5" /> Schedule Viewing
            </PrimaryButton>
          )
        }
      />
      <ErrorBanner message={actionError} onClose={() => setActionError(null)} />

      <FilterBar>
        <div className="flex gap-2">
          {(['upcoming', 'past', 'all'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() =>
                setFilters(
                  v === 'upcoming'
                    ? { upcoming: true, sort: 'scheduled_at', to: undefined }
                    : v === 'past'
                      ? { upcoming: undefined, sort: '-scheduled_at', to: new Date().toISOString() }
                      : { upcoming: undefined, sort: '-scheduled_at', to: undefined }
                )
              }
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${view === v ? 'bg-[#b98f42] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {humanize(v)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label="Status" value={String(filters.status ?? '')} onChange={(status) => setFilters({ status })}>
            <option value="">Status: All</option>
            {VIEWING_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </FilterSelect>
          {can('viewings.read_all') && (
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
        <Table headers={[{ label: 'When' }, { label: 'Property' }, { label: 'With' }, { label: 'Agent' }, { label: 'Status' }, { label: 'Actions', align: 'right' }]}>
          <TableState colSpan={6} loading={loading && items.length === 0} error={error} empty={!loading && items.length === 0} emptyText="No viewings here." />
          {items.map((v) => (
            <tr key={v._id} className="transition-all hover:bg-gray-50/50">
              <td className="px-6 py-6">
                <p className="text-sm font-bold text-gray-900">{formatDate(v.scheduled_at)}</p>
                <p className="text-xs font-medium text-gray-400">{formatTime(v.scheduled_at)} · {v.duration_minutes ?? 30} min</p>
              </td>
              <td className="px-6 py-6">
                <p className="max-w-[240px] truncate font-bold text-gray-700">{v.property?.title_en}</p>
                <p className="text-xs font-bold tracking-wider text-gray-400">{v.property?.reference_number}</p>
              </td>
              <td className="px-6 py-6 text-sm">
                <p className="font-medium text-gray-900">{v.lead?.full_name ?? v.client?.full_name}</p>
                <p className="text-xs text-gray-400">{v.lead?.phone ?? v.client?.phone}</p>
              </td>
              <td className="px-6 py-6 text-sm font-medium text-gray-700">{v.assigned_agent?.full_name}</td>
              <td className="px-6 py-6">
                <select
                  aria-label="Viewing status"
                  value={v.status}
                  disabled={!can('viewings.update')}
                  onChange={(e) => setStatus(v, e.target.value)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider outline-none ${STATUS_TEXT[VIEWING_STATUS_COLORS[v.status]] ?? STATUS_TEXT.gray}`}
                >
                  {VIEWING_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                </select>
              </td>
              <td className="px-6 py-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  {can('viewings.update') && (
                    <IconButton title="Edit" onClick={() => setForm({ viewing: v })}><Edit2 className="h-5 w-5" /></IconButton>
                  )}
                  {can('viewings.delete') && (
                    <IconButton title="Delete" tone="danger" onClick={() => setDeleting(v)}><Trash2 className="h-5 w-5" /></IconButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination meta={meta} noun="viewings" onPage={setPage} />
      </div>

      {form && <ViewingFormModal key={form.viewing?._id ?? 'new'} viewing={form.viewing} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete viewing"
        message="Delete this viewing? To keep a record, set its status to Cancelled instead."
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
