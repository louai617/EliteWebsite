'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PRIORITIES, PURPOSES, humanize } from '@/lib/shared/constants';
import type { LeadRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useLeadsStore, useSettingsStore } from '@/store/crmStores';
import { AgentSelect, EntityPicker } from '../pickers';
import { cleanPayload, NumberInput, SelectInput, TextArea, TextInput, toIso, useCrmForm } from '../form';
import { ErrorBanner, Field, Modal, PrimaryButton, SecondaryButton, SectionTitle, inputClass, toLocalInput } from '../ui';

function initialValues(lead?: LeadRow | null) {
  return {
    full_name: lead?.full_name ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    whatsapp: lead?.whatsapp ?? '',
    source: lead?.source ?? 'walk_in',
    status: lead?.status ?? '',
    priority: lead?.priority ?? 'medium',
    assigned_agent: lead?.assigned_agent?._id ?? '',
    purpose: lead?.purpose ?? '',
    property_type: lead?.property_type ?? '',
    preferred_location: lead?.preferred_location ?? '',
    budget_min: lead?.budget_min ?? '',
    budget_max: lead?.budget_max ?? '',
    bedrooms: lead?.bedrooms ?? '',
    bathrooms: lead?.bathrooms ?? '',
    next_follow_up_at: toLocalInput(lead?.next_follow_up_at),
    last_contact_at: toLocalInput(lead?.last_contact_at),
    tags: (lead?.tags ?? []).join(', '),
    notes: lead?.notes ?? '',
  };
}

export default function LeadFormModal({
  open,
  lead,
  onClose,
}: {
  open: boolean;
  lead?: LeadRow | null;
  onClose: () => void;
}) {
  const settings = useSettingsStore((s) => s.settings);
  const can = useAuthStore((s) => s.can);
  const create = useLeadsStore((s) => s.create);
  const update = useLeadsStore((s) => s.update);
  // The parent mounts this modal fresh (keyed by lead) each time it opens, so initial state is enough.
  const form = useCrmForm(initialValues(lead));
  const [properties, setProperties] = useState<{ _id: string; label: string }[]>(() =>
    (lead?.interested_properties ?? []).map((p) => ({ _id: p._id, label: `${p.title_en} (${p.reference_number})` }))
  );
  const { values, set, errors } = form;
  const setField = set as (key: string, value: unknown) => void;

  const save = async () => {
    const payload: Record<string, unknown> = {
      ...cleanPayload(values),
      next_follow_up_at: toIso(values.next_follow_up_at),
      last_contact_at: toIso(values.last_contact_at),
      tags: values.tags,
      interested_properties: properties.map((p) => p._id),
    };
    if (!can('leads.update_all')) delete payload.assigned_agent;
    if (!lead && !payload.status) delete payload.status;
    const ok = await form.submit(() => (lead ? update(lead._id, payload) : create(payload)));
    if (ok) onClose();
  };

  const common = { values, set: setField, errors };

  return (
    <Modal
      open={open}
      wide
      title={lead ? `Edit Lead — ${lead.full_name}` : 'Add Manual Lead'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} loading={form.saving}>{lead ? 'Save Changes' : 'Create Lead'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-6">
        <ErrorBanner message={form.formError} />

        <div>
          <SectionTitle>Contact</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="full_name" label="Full name" required {...common} />
            <TextInput name="email" label="Email" type="email" {...common} />
            <TextInput name="phone" label="Phone" type="tel" placeholder="+974 0000 0000" {...common} />
            <TextInput name="whatsapp" label="WhatsApp" type="tel" placeholder="+974 0000 0000" {...common} />
          </div>
        </div>

        <div>
          <SectionTitle>Pipeline</SectionTitle>
          <div className="grid gap-4 md:grid-cols-4">
            <SelectInput
              name="status"
              label="Status"
              emptyLabel={lead ? undefined : 'Default (first stage)'}
              options={(settings?.lead_statuses ?? []).map((s) => ({ value: s.key, label: s.label }))}
              {...common}
            />
            <SelectInput
              name="source"
              label="Source"
              options={(settings?.lead_sources ?? []).map((s) => ({ value: s.key, label: s.label }))}
              {...common}
            />
            <SelectInput name="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: humanize(p) }))} {...common} />
            {can('leads.update_all') ? (
              <Field label="Assigned agent" error={errors.assigned_agent}>
                <AgentSelect value={values.assigned_agent as string} onChange={(id) => setField('assigned_agent', id ?? '')} />
              </Field>
            ) : (
              <Field label="Assigned agent">
                <input className={inputClass} disabled value={lead?.assigned_agent?.full_name ?? 'You'} />
              </Field>
            )}
            <TextInput name="next_follow_up_at" label="Next follow-up" type="datetime-local" {...common} />
            <TextInput name="last_contact_at" label="Last contact" type="datetime-local" {...common} />
            <TextInput name="tags" label="Tags" placeholder="vip, cash buyer" className="md:col-span-2" {...common} hint="Comma separated" />
          </div>
        </div>

        <div>
          <SectionTitle>Requirements</SectionTitle>
          <div className="grid gap-4 md:grid-cols-4">
            <SelectInput name="purpose" label="Purpose" emptyLabel="Any" options={PURPOSES.map((p) => ({ value: p, label: p === 'sale' ? 'Buy' : 'Rent' }))} {...common} />
            <SelectInput
              name="property_type"
              label="Property type"
              emptyLabel="Any"
              options={(settings?.property_types ?? []).map((t) => ({ value: t.key, label: t.label_en }))}
              {...common}
            />
            <SelectInput
              name="preferred_location"
              label="Preferred location"
              emptyLabel="Any"
              options={(settings?.locations ?? []).map((l) => ({ value: l.name_en, label: l.name_en }))}
              {...common}
            />
            <div className="grid grid-cols-2 gap-4">
              <NumberInput name="bedrooms" label="Beds" {...common} />
              <NumberInput name="bathrooms" label="Baths" {...common} />
            </div>
            <NumberInput name="budget_min" label="Budget min (QAR)" className="md:col-span-2" {...common} />
            <NumberInput name="budget_max" label="Budget max (QAR)" className="md:col-span-2" {...common} />
          </div>

          <Field label="Interested properties" className="mt-4" error={errors.interested_properties}>
            <div className="space-y-2">
              {properties.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {properties.map((p) => (
                    <span key={p._id} className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">
                      {p.label}
                      <button type="button" aria-label="Remove" onClick={() => setProperties((list) => list.filter((x) => x._id !== p._id))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <EntityPicker
                key={properties.length}
                resource="properties"
                value={null}
                placeholder="Search by title or reference to add…"
                onChange={(id, option) => {
                  if (id && option && !properties.some((p) => p._id === id)) {
                    setProperties((list) => [...list, { _id: id, label: `${option.label}${option.sublabel ? ` (${option.sublabel.split(' · ')[0]})` : ''}` }]);
                  }
                }}
              />
            </div>
          </Field>
        </div>

        <TextArea name="notes" label="Notes" rows={4} {...common} />
        {lead?.message && (
          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">Website message</p>
            {lead.message}
          </div>
        )}
      </div>
    </Modal>
  );
}
