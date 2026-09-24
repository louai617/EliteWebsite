'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api, { apiErrorMessage } from '@/lib/api';
import {
  AMENITIES,
  COMPLETION,
  FURNISHING,
  IMAGE_HOSTS,
  OWNERSHIP,
  PROPERTY_STATUSES,
  humanize,
} from '@/lib/shared/constants';
import type { PropertyRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { usePropertiesStore, useSettingsStore } from '@/store/crmStores';
import { AgentSelect, EntityPicker } from '../pickers';
import { CheckboxGroup, cleanPayload, NumberInput, SelectInput, TextArea, TextInput, toIso, useCrmForm } from '../form';
import { ErrorBanner, Field, Modal, PrimaryButton, SecondaryButton, SectionTitle, Toggle, toLocalInput } from '../ui';

const lines = (list?: string[]) => (list ?? []).join('\n');
const splitLines = (value: unknown) =>
  String(value ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

function initialValues(p?: PropertyRow | null) {
  return {
    title_en: p?.title_en ?? '',
    title_ar: p?.title_ar ?? '',
    reference_number: p?.reference_number ?? '',
    type: p?.type ?? 'apartment',
    purpose: p?.purpose ?? 'sale',
    status: p?.status ?? 'available',
    price: p?.price ?? '',
    currency: p?.currency ?? 'QAR',
    price_frequency: p?.price_frequency ?? 'year',
    bedrooms: p?.bedrooms ?? '',
    bathrooms: p?.bathrooms ?? '',
    area_sqm: p?.area_sqm ?? '',
    plot_sqm: p?.plot_sqm ?? '',
    floor: p?.floor ?? '',
    total_floors: p?.total_floors ?? '',
    parking: p?.parking ?? '',
    furnishing: p?.furnishing ?? 'unfurnished',
    completion: p?.completion ?? 'ready',
    ownership: p?.ownership ?? 'freehold',
    available_from: toLocalInput(p?.available_from, true),
    year_built: p?.year_built ?? '',
    handover: p?.handover ?? '',
    developer_en: p?.developer_en ?? '',
    service_charge_sqm: p?.service_charge_sqm ?? '',
    area_key: p?.location?.area_key ?? '',
    community_en: p?.location?.community_en ?? '',
    community_ar: p?.location?.community_ar ?? '',
    address_en: p?.location?.address_en ?? '',
    lat: p?.location?.lat ?? '',
    lng: p?.location?.lng ?? '',
    description_en: p?.description_en ?? '',
    description_ar: p?.description_ar ?? '',
    amenities: p?.amenities ?? [],
    images: lines(p?.images),
    videos: lines(p?.videos),
    floor_plan: p?.floor_plan ?? '',
    assigned_agent: p?.assigned_agent?._id ?? '',
    owner: p?.owner?._id ?? '',
    owner_name: p?.owner_contact?.name ?? '',
    owner_phone: p?.owner_contact?.phone ?? '',
    owner_email: p?.owner_contact?.email ?? '',
    internal_notes: p?.internal_notes ?? '',
    is_active: p?.is_active ?? false,
    is_featured: p?.is_featured ?? false,
    is_verified: p?.is_verified ?? false,
    is_exclusive: p?.is_exclusive ?? false,
  };
}

type Values = ReturnType<typeof initialValues>;

function PropertyForm({ property, onClose }: { property: PropertyRow | null; onClose: () => void }) {
  const settings = useSettingsStore((s) => s.settings);
  const can = useAuthStore((s) => s.can);
  const create = usePropertiesStore((s) => s.create);
  const update = usePropertiesStore((s) => s.update);
  const form = useCrmForm<Values>(initialValues(property));
  const { values, errors } = form;
  const set = form.set as (key: string, value: unknown) => void;
  const common = { values, set, errors };

  const save = async () => {
    const v = values;
    const payload: Record<string, unknown> = {
      ...cleanPayload(v, [
        'title_en', 'title_ar', 'type', 'purpose', 'status', 'price', 'currency', 'bedrooms', 'bathrooms', 'area_sqm',
        'plot_sqm', 'floor', 'total_floors', 'parking', 'furnishing', 'completion', 'ownership', 'year_built', 'handover',
        'developer_en', 'service_charge_sqm', 'description_en', 'description_ar', 'amenities', 'floor_plan', 'owner',
        'internal_notes', 'is_active', 'is_featured', 'is_verified', 'is_exclusive',
      ]),
      price_frequency: v.purpose === 'rent' ? v.price_frequency : null,
      available_from: toIso(v.available_from),
      images: splitLines(v.images),
      videos: splitLines(v.videos),
      location: cleanPayload({
        area_key: v.area_key,
        community_en: v.community_en,
        community_ar: v.community_ar,
        address_en: v.address_en,
        lat: v.lat,
        lng: v.lng,
      }),
      owner_contact: cleanPayload({ name: v.owner_name, phone: v.owner_phone, email: v.owner_email }),
    };
    if (v.reference_number) payload.reference_number = v.reference_number;
    if (can('properties.update_all')) payload.assigned_agent = v.assigned_agent || null;
    if (!property) {
      // On create, blank optional fields are simply omitted.
      for (const key of Object.keys(payload)) if (payload[key] === null) delete payload[key];
    }

    const ok = await form.submit(() => (property ? update(property._id, payload) : create(payload)));
    if (ok) onClose();
  };

  // Map nested server errors (location.lat, owner_contact.phone…) onto the flat inputs.
  const flatErrors = {
    ...errors,
    lat: errors['location.lat'] ?? errors.lat,
    lng: errors['location.lng'] ?? errors.lng,
    owner_phone: errors['owner_contact.phone'],
    owner_email: errors['owner_contact.email'],
  };
  const withErrors = { ...common, errors: flatErrors };

  return (
    <Modal
      open
      wide
      title={property ? `Edit ${property.reference_number}` : 'Add New Property'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} loading={form.saving}>{property ? 'Save Changes' : 'Create Property'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-8">
        <ErrorBanner message={form.formError} />

        <div>
          <SectionTitle>Listing</SectionTitle>
          <div className="grid gap-4 md:grid-cols-4">
            <TextInput name="title_en" label="Title (English)" required className="md:col-span-2" {...common} />
            <TextInput name="title_ar" label="Title (Arabic)" className="md:col-span-2" {...common} />
            <TextInput name="reference_number" label="Reference" placeholder="Auto (ELT-00001)" {...common} />
            <SelectInput
              name="type"
              label="Property type"
              required
              options={(settings?.property_types ?? []).map((t) => ({ value: t.key, label: t.label_en }))}
              {...common}
            />
            <SelectInput name="purpose" label="Purpose" required options={[{ value: 'sale', label: 'For Sale' }, { value: 'rent', label: 'For Rent' }]} {...common} />
            <SelectInput name="status" label="Status" options={PROPERTY_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} {...common} />
            <NumberInput name="price" label={values.purpose === 'rent' ? 'Rent' : 'Price'} required className="md:col-span-2" {...common} />
            <TextInput name="currency" label="Currency" {...common} />
            {values.purpose === 'rent' ? (
              <SelectInput name="price_frequency" label="Rent per" options={[{ value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }]} {...common} />
            ) : (
              <div />
            )}
          </div>
        </div>

        <div>
          <SectionTitle>Details</SectionTitle>
          <div className="grid gap-4 md:grid-cols-4">
            <NumberInput name="bedrooms" label="Bedrooms" {...common} />
            <NumberInput name="bathrooms" label="Bathrooms" {...common} />
            <NumberInput name="area_sqm" label="Area (m²)" {...common} />
            <NumberInput name="plot_sqm" label="Plot (m²)" {...common} />
            <NumberInput name="floor" label="Floor" min={-5} {...common} />
            <NumberInput name="total_floors" label="Total floors" {...common} />
            <NumberInput name="parking" label="Parking" {...common} />
            <SelectInput name="furnishing" label="Furnishing" options={FURNISHING.map((f) => ({ value: f, label: humanize(f) }))} {...common} />
            <SelectInput name="completion" label="Completion" options={COMPLETION.map((c) => ({ value: c, label: c === 'offplan' ? 'Off-plan' : 'Ready' }))} {...common} />
            <SelectInput name="ownership" label="Ownership" options={OWNERSHIP.map((o) => ({ value: o, label: humanize(o) }))} {...common} />
            <TextInput name="available_from" label="Available from" type="date" {...common} />
            <NumberInput name="year_built" label="Year built" min={1800} {...common} />
            <TextInput name="handover" label="Handover" placeholder="Q4 2027" {...common} />
            <TextInput name="developer_en" label="Developer" {...common} />
            <NumberInput name="service_charge_sqm" label="Service charge / m²" {...common} />
          </div>
        </div>

        <div>
          <SectionTitle>Location</SectionTitle>
          <div className="grid gap-4 md:grid-cols-4">
            <SelectInput
              name="area_key"
              label="Area"
              emptyLabel="Select area"
              options={(settings?.locations ?? []).map((l) => ({ value: l.key, label: `${l.name_en}${l.city_en ? `, ${l.city_en}` : ''}` }))}
              {...common}
            />
            <TextInput name="community_en" label="Community / building" {...common} />
            <TextInput name="community_ar" label="Community (Arabic)" {...common} />
            <TextInput name="address_en" label="Address" {...common} />
            <NumberInput name="lat" label="Latitude" min={-90} {...withErrors} />
            <NumberInput name="lng" label="Longitude" min={-180} {...withErrors} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextArea name="description_en" label="Description (English)" rows={6} {...common} />
          <div dir="rtl">
            <TextArea name="description_ar" label="الوصف (عربي)" rows={6} {...common} />
          </div>
        </div>

        <CheckboxGroup name="amenities" label="Amenities" options={AMENITIES.map((a) => ({ value: a, label: humanize(a) }))} {...common} />

        <div>
          <SectionTitle>Media</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <TextArea name="images" label="Image URLs (one per line)" rows={4} hint={`Allowed hosts: ${IMAGE_HOSTS.join(', ')}`} {...common} />
            <div className="space-y-4">
              <TextArea name="videos" label="Video URLs (one per line)" rows={2} {...common} />
              <TextInput name="floor_plan" label="Floor plan image URL" {...common} />
            </div>
          </div>
          {Object.keys(errors).some((k) => k.startsWith('images')) && (
            <p className="mt-2 text-xs font-medium text-red-500">
              {Object.entries(errors).find(([k]) => k.startsWith('images'))?.[1]}
            </p>
          )}
        </div>

        <div>
          <SectionTitle>Agent & Owner (internal)</SectionTitle>
          <div className="grid gap-4 md:grid-cols-3">
            {can('properties.update_all') && (
              <Field label="Listing agent">
                <AgentSelect value={values.assigned_agent} onChange={(id) => set('assigned_agent', id ?? '')} />
              </Field>
            )}
            <Field label="Owner (CRM client)" className="md:col-span-2">
              <EntityPicker
                resource="clients"
                value={values.owner || null}
                initial={property?.owner ? { _id: property.owner._id, label: property.owner.full_name, sublabel: property.owner.phone } : null}
                placeholder="Search landlords / sellers…"
                onChange={(id) => set('owner', id ?? '')}
              />
            </Field>
            <TextInput name="owner_name" label="Owner contact name" {...withErrors} />
            <TextInput name="owner_phone" label="Owner phone" type="tel" {...withErrors} />
            <TextInput name="owner_email" label="Owner email" type="email" {...withErrors} />
            <TextArea name="internal_notes" label="Internal notes" className="md:col-span-3" rows={2} {...common} />
          </div>
        </div>

        <div>
          <SectionTitle>Publishing</SectionTitle>
          <div className="grid gap-4 md:grid-cols-4">
            {([
              ['is_active', 'Published on website'],
              ['is_featured', 'Featured'],
              ['is_verified', 'Verified'],
              ['is_exclusive', 'Exclusive'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
                <span className="text-sm font-bold text-gray-700">{label}</span>
                <Toggle checked={Boolean(values[key])} onChange={(checked) => set(key, checked)} label={label} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Loads the full listing (the table only holds a light projection), then shows the form. */
export default function PropertyFormModal({ propertyId, onClose }: { propertyId: string | null; onClose: () => void }) {
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    api
      .get<{ data: PropertyRow }>(`/properties/${propertyId}`)
      .then(({ data }) => setProperty(data.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [propertyId]);

  if (!propertyId) return <PropertyForm property={null} onClose={onClose} />;
  if (error) {
    return (
      <Modal open title="Property" onClose={onClose}>
        <ErrorBanner message={error} />
      </Modal>
    );
  }
  if (!property) {
    return (
      <Modal open title="Loading…" onClose={onClose}>
        <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-[#b98f42]" />
      </Modal>
    );
  }
  return <PropertyForm property={property} onClose={onClose} />;
}
