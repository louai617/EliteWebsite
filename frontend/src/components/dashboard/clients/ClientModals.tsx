'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api, { apiErrorMessage } from '@/lib/api';
import { CLIENT_TYPES, FURNISHING, PURPOSES, humanize } from '@/lib/shared/constants';
import type { ClientRow, DealRow, LeadRow, PropertyRow, TaskRow, ViewingRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useClientsStore, useSettingsStore } from '@/store/crmStores';
import { AgentSelect } from '../pickers';
import { CheckboxGroup, cleanPayload, NumberInput, SelectInput, TextArea, TextInput, useCrmForm } from '../form';
import {
  Badge,
  DEAL_STATUS_COLORS,
  ErrorBanner,
  Field,
  formatDate,
  formatMoney,
  Modal,
  PrimaryButton,
  PROPERTY_STATUS_COLORS,
  SecondaryButton,
  SectionTitle,
  VIEWING_STATUS_COLORS,
} from '../ui';

function initialValues(c?: ClientRow | null) {
  return {
    full_name: c?.full_name ?? '',
    types: c?.types ?? ['buyer'],
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    whatsapp: c?.whatsapp ?? '',
    nationality: c?.nationality ?? '',
    company: c?.company ?? '',
    preferred_locations: c?.preferred_locations ?? [],
    purpose: c?.requirements?.purpose ?? '',
    property_types: c?.requirements?.property_types ?? [],
    bedrooms_min: c?.requirements?.bedrooms_min ?? '',
    bathrooms_min: c?.requirements?.bathrooms_min ?? '',
    furnishing: c?.requirements?.furnishing ?? '',
    requirement_notes: c?.requirements?.notes ?? '',
    budget_min: c?.budget_min ?? '',
    budget_max: c?.budget_max ?? '',
    assigned_agent: c?.assigned_agent?._id ?? '',
    tags: (c?.tags ?? []).join(', '),
    notes: c?.notes ?? '',
  };
}

export function ClientFormModal({ client, onClose }: { client: ClientRow | null; onClose: () => void }) {
  const settings = useSettingsStore((s) => s.settings);
  const can = useAuthStore((s) => s.can);
  const create = useClientsStore((s) => s.create);
  const update = useClientsStore((s) => s.update);
  const form = useCrmForm(initialValues(client));
  const { values, errors } = form;
  const set = form.set as (key: string, value: unknown) => void;
  const common = { values, set, errors };

  const save = async () => {
    const payload: Record<string, unknown> = {
      ...cleanPayload(values, ['full_name', 'types', 'phone', 'email', 'whatsapp', 'nationality', 'company', 'preferred_locations', 'budget_min', 'budget_max', 'notes']),
      tags: values.tags,
      requirements: cleanPayload({
        purpose: values.purpose,
        property_types: values.property_types,
        bedrooms_min: values.bedrooms_min,
        bathrooms_min: values.bathrooms_min,
        furnishing: values.furnishing,
        notes: values.requirement_notes,
      }),
    };
    if (can('clients.update_all')) payload.assigned_agent = values.assigned_agent || null;
    const ok = await form.submit(() => (client ? update(client._id, payload) : create(payload)));
    if (ok) onClose();
  };

  return (
    <Modal
      open
      wide
      title={client ? `Edit Client — ${client.full_name}` : 'Add Client'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} loading={form.saving}>{client ? 'Save Changes' : 'Create Client'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-8">
        <ErrorBanner message={form.formError} />
        <div>
          <SectionTitle>Client</SectionTitle>
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput name="full_name" label="Full name" required {...common} />
            <TextInput name="phone" label="Phone" type="tel" {...common} />
            <TextInput name="email" label="Email" type="email" {...common} />
            <TextInput name="whatsapp" label="WhatsApp" type="tel" {...common} />
            <TextInput name="nationality" label="Nationality" {...common} />
            <TextInput name="company" label="Company" {...common} />
          </div>
          <CheckboxGroup name="types" label="Client type *" className="mt-4" options={CLIENT_TYPES.map((t) => ({ value: t, label: humanize(t) }))} {...common} />
        </div>

        <div>
          <SectionTitle>Requirements</SectionTitle>
          <div className="grid gap-4 md:grid-cols-4">
            <SelectInput name="purpose" label="Looking to" emptyLabel="Any" options={PURPOSES.map((p) => ({ value: p, label: p === 'sale' ? 'Buy' : 'Rent' }))} {...common} />
            <NumberInput name="bedrooms_min" label="Min beds" {...common} />
            <NumberInput name="bathrooms_min" label="Min baths" {...common} />
            <SelectInput name="furnishing" label="Furnishing" emptyLabel="Any" options={FURNISHING.map((f) => ({ value: f, label: humanize(f) }))} {...common} />
            <NumberInput name="budget_min" label="Budget min (QAR)" className="md:col-span-2" {...common} />
            <NumberInput name="budget_max" label="Budget max (QAR)" className="md:col-span-2" {...common} />
          </div>
          <CheckboxGroup
            name="property_types"
            label="Property types"
            className="mt-4"
            options={(settings?.property_types ?? []).map((t) => ({ value: t.key, label: t.label_en }))}
            {...common}
          />
          <CheckboxGroup
            name="preferred_locations"
            label="Preferred locations"
            className="mt-4"
            options={(settings?.locations ?? []).map((l) => ({ value: l.name_en, label: l.name_en }))}
            {...common}
          />
          <TextArea name="requirement_notes" label="Requirement notes" className="mt-4" rows={2} {...common} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {can('clients.update_all') && (
            <Field label="Assigned agent">
              <AgentSelect value={values.assigned_agent} onChange={(id) => set('assigned_agent', id ?? '')} />
            </Field>
          )}
          <TextInput name="tags" label="Tags" hint="Comma separated" className="md:col-span-2" {...common} />
          <TextArea name="notes" label="Notes" className="md:col-span-3" rows={3} {...common} />
        </div>
      </div>
    </Modal>
  );
}

type ClientDetail = ClientRow & {
  leads: LeadRow[];
  properties: PropertyRow[];
  viewings: ViewingRow[];
  deals: DealRow[];
  tasks: TaskRow[];
};

export function ClientDetailModal({ clientId, onClose, onEdit }: { clientId: string; onClose: () => void; onEdit: (c: ClientRow) => void }) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const can = useAuthStore((s) => s.can);
  const statusLabel = useSettingsStore((s) => s.statusLabel);
  const statusColor = useSettingsStore((s) => s.statusColor);

  useEffect(() => {
    api
      .get<{ data: ClientDetail }>(`/clients/${clientId}`)
      .then(({ data }) => setClient(data.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [clientId]);

  const list = <T,>(title: string, rows: T[], render: (row: T) => React.ReactNode) => (
    <div>
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? <p className="text-sm text-gray-400">None.</p> : <ul className="space-y-2 text-sm">{rows.map(render)}</ul>}
    </div>
  );

  return (
    <Modal
      open
      wide
      title={client?.full_name ?? 'Client'}
      onClose={onClose}
      footer={
        client && (
          <>
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
            {can('clients.update') && <PrimaryButton onClick={() => onEdit(client)}>Edit Client</PrimaryButton>}
          </>
        )
      }
    >
      <ErrorBanner message={error} />
      {!client && !error && <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-[#b98f42]" />}
      {client && (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            {client.types.map((t) => <Badge key={t} color="gold">{humanize(t)}</Badge>)}
            {client.tags.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
          <dl className="grid grid-cols-2 gap-5 text-sm md:grid-cols-4">
            {[
              ['Phone', client.phone],
              ['Email', client.email],
              ['WhatsApp', client.whatsapp],
              ['Nationality', client.nationality],
              ['Agent', client.assigned_agent?.full_name ?? 'Unassigned'],
              ['Budget', client.budget_min || client.budget_max ? `${formatMoney(client.budget_min)} – ${formatMoney(client.budget_max)}` : ''],
              ['Locations', client.preferred_locations.join(', ')],
              ['Since', formatDate(client.created_at)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{value || '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-6 md:grid-cols-2">
            {list('Leads', client.leads, (l) => (
              <li key={l._id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span>{formatDate(l.created_at)}</span>
                <Badge color={statusColor(l.status)}>{statusLabel(l.status)}</Badge>
              </li>
            ))}
            {list('Owned properties', client.properties, (p) => (
              <li key={p._id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="truncate">{p.reference_number} · {p.title_en}</span>
                <Badge color={PROPERTY_STATUS_COLORS[p.status]}>{humanize(p.status)}</Badge>
              </li>
            ))}
            {list('Viewings', client.viewings, (v) => (
              <li key={v._id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="truncate">{v.property?.title_en} · {formatDate(v.scheduled_at, true)}</span>
                <Badge color={VIEWING_STATUS_COLORS[v.status]}>{humanize(v.status)}</Badge>
              </li>
            ))}
            {list('Deals', client.deals, (d) => (
              <li key={d._id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="truncate">{d.property?.title_en} · {formatMoney(d.amount, d.currency)}</span>
                <Badge color={DEAL_STATUS_COLORS[d.status]}>{humanize(d.status)}</Badge>
              </li>
            ))}
            {list('Open tasks', client.tasks, (t) => (
              <li key={t._id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="truncate">{t.title}</span>
                <span className="text-xs text-gray-500">{t.due_at ? formatDate(t.due_at) : ''}</span>
              </li>
            ))}
          </div>
          {client.notes && (
            <div>
              <SectionTitle>Notes</SectionTitle>
              <p className="whitespace-pre-line text-sm text-gray-700">{client.notes}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
