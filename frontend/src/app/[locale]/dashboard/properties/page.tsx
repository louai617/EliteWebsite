'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import {
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Star,
} from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { FURNISHING, PROPERTY_STATUSES, humanize } from '@/lib/shared/constants';
import type { PropertyRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { usePropertiesStore, useSettingsStore } from '@/store/crmStores';
import { AgentSelect } from '@/components/dashboard/pickers';
import PropertyFormModal from '@/components/dashboard/properties/PropertyFormModal';
import {
  Badge,
  ConfirmDialog,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  IconButton,
  Pagination,
  PROPERTY_STATUS_COLORS,
  SearchInput,
  Table,
  TableState,
} from '@/components/dashboard/ui';

const AdminPropertiesPage = () => {
  const locale = useLocale();
  const { items, meta, filters, loading, error, setFilters, setPage, fetch, remove, update } = usePropertiesStore();
  const settings = useSettingsStore((s) => s.settings);
  const typeLabel = useSettingsStore((s) => s.typeLabel);
  const can = useAuthStore((s) => s.can);
  const userId = useAuthStore((s) => s.user?.id);

  const [formFor, setFormFor] = useState<string | null | undefined>(undefined); // undefined = closed, null = new
  const [deleting, setDeleting] = useState<PropertyRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const canEdit = (p: PropertyRow) =>
    can('properties.update_all') || (can('properties.update') && p.assigned_agent?._id === userId);

  const toggle = async (p: PropertyRow, field: 'is_active' | 'is_featured') => {
    setActionError(null);
    try {
      await update(p._id, { [field]: !p[field] });
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await remove(deleting._id);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  };

  const priceParts = String(filters.price_range ?? '');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Properties Management</h1>
          <p className="text-gray-500 font-medium tracking-tight">Manage all your property listings from one place.</p>
        </div>
        {can('properties.create') && (
          <button
            type="button"
            onClick={() => setFormFor(null)}
            className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-[#b98f42] transition-all flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Add New Property
          </button>
        )}
      </div>

      <ErrorBanner message={actionError} onClose={() => setActionError(null)} />

      {/* Filters & Search */}
      <FilterBar>
        <SearchInput
          value={String(filters.q ?? '')}
          onChange={(q) => setFilters({ q })}
          placeholder="Search by title, ref, location..."
        />
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <FilterSelect label="Location" value={String(filters.location ?? '')} onChange={(location) => setFilters({ location })}>
            <option value="">Location: All</option>
            {settings?.locations.map((l) => <option key={l.key} value={l.key}>{l.name_en}</option>)}
          </FilterSelect>
          <FilterSelect label="Type" value={String(filters.type ?? '')} onChange={(type) => setFilters({ type })}>
            <option value="">Type: All</option>
            {settings?.property_types.map((t) => <option key={t.key} value={t.key}>{t.label_en}</option>)}
          </FilterSelect>
          <FilterSelect label="Purpose" value={String(filters.purpose ?? '')} onChange={(purpose) => setFilters({ purpose })}>
            <option value="">Sale & Rent</option>
            <option value="sale">For Sale</option>
            <option value="rent">For Rent</option>
          </FilterSelect>
          <FilterSelect label="Status" value={String(filters.status ?? '')} onChange={(status) => setFilters({ status })}>
            <option value="">Status: All</option>
            {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </FilterSelect>
          <FilterSelect label="Bedrooms" value={String(filters.bedrooms ?? '')} onChange={(bedrooms) => setFilters({ bedrooms })}>
            <option value="">Beds: Any</option>
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 0 ? 'Studio' : n === 5 ? '5+' : n}</option>)}
          </FilterSelect>
          <FilterSelect label="Bathrooms" value={String(filters.bathrooms ?? '')} onChange={(bathrooms) => setFilters({ bathrooms })}>
            <option value="">Baths: Any</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 5 ? '5+' : n}</option>)}
          </FilterSelect>
          <FilterSelect label="Furnishing" value={String(filters.furnishing ?? '')} onChange={(furnishing) => setFilters({ furnishing })}>
            <option value="">Furnishing: Any</option>
            {FURNISHING.map((f) => <option key={f} value={f}>{humanize(f)}</option>)}
          </FilterSelect>
          <FilterSelect
            label="Price"
            value={priceParts}
            onChange={(range) => {
              const [min, max] = range.split('-');
              setFilters({ price_range: range, price_min: min || undefined, price_max: max || undefined });
            }}
          >
            <option value="">Price: Any</option>
            <option value="-10000">Under 10K</option>
            <option value="10000-50000">10K – 50K</option>
            <option value="50000-1000000">50K – 1M</option>
            <option value="1000000-3000000">1M – 3M</option>
            <option value="3000000-10000000">3M – 10M</option>
            <option value="10000000-">10M+</option>
          </FilterSelect>
          {can('properties.read_all') && (
            <div className="w-44">
              <AgentSelect
                value={String(filters.assigned_agent ?? '')}
                onChange={(id) => setFilters({ assigned_agent: id ?? '' })}
                emptyLabel="Agent: All"
                className="py-2 rounded-lg bg-white font-bold text-gray-600"
              />
            </div>
          )}
          <FilterSelect label="Sort" value={String(filters.sort ?? '-created_at')} onChange={(sort) => setFilters({ sort })}>
            <option value="-created_at">Sort by: Newest</option>
            <option value="-price">Sort by: Price High</option>
            <option value="price">Sort by: Price Low</option>
            <option value="-views">Sort by: Most Viewed</option>
          </FilterSelect>
        </div>
      </FilterBar>

      {/* Properties Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <Table
          headers={[
            { label: 'Property' },
            { label: 'Price & Type' },
            { label: 'Status' },
            { label: 'Stats' },
            { label: 'Actions', align: 'right' },
          ]}
        >
          <TableState colSpan={5} loading={loading && items.length === 0} error={error} empty={!loading && items.length === 0} emptyText="No properties match these filters." />
          {items.map((property) => (
            <tr key={property._id} className="hover:bg-gray-50/50 transition-all">
              <td className="px-6 py-6">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                    {property.images[0] && (
                      <Image src={property.images[0]} alt={property.title_en} fill sizes="64px" className="object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 mb-1 truncate max-w-[220px]">{property.title_en}</p>
                    <p className="text-xs text-gray-400 font-bold tracking-wider">REF: {property.reference_number}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[220px]">
                      {[property.location?.community_en, property.location?.area_en].filter(Boolean).join(', ')}
                      {property.assigned_agent ? ` · ${property.assigned_agent.full_name}` : ''}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-6">
                <p className="font-bold text-[#b98f42] mb-1">
                  {property.price.toLocaleString()} {property.currency}
                  {property.purpose === 'rent' && property.price_frequency && (
                    <span className="text-xs text-gray-400 font-medium"> /{property.price_frequency}</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 font-medium capitalize">
                  {typeLabel(property.type)} • For {property.purpose} • {property.bedrooms ?? 0} BR
                </p>
              </td>
              <td className="px-6 py-6">
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={!canEdit(property)}
                    onClick={() => toggle(property, 'is_active')}
                    title={canEdit(property) ? 'Toggle website visibility' : undefined}
                    className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      property.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {property.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {property.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <Badge color={PROPERTY_STATUS_COLORS[property.status]}>{humanize(property.status)}</Badge>
                  {property.is_featured && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 w-fit">
                      Featured
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-6">
                <div className="flex items-center gap-4 text-gray-500">
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">{property.views}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">{property.inquiries ?? 0}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Leads</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  {canEdit(property) && (
                    <IconButton title="Edit" onClick={() => setFormFor(property._id)}>
                      <Edit2 className="w-5 h-5" />
                    </IconButton>
                  )}
                  {property.is_active && (
                    <a
                      href={`/${locale}/properties/${property._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on website"
                      className="p-2 text-gray-400 hover:text-[#b98f42] transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                  {canEdit(property) && (
                    <IconButton title={property.is_featured ? 'Unfeature' : 'Feature'} tone="gold" onClick={() => toggle(property, 'is_featured')}>
                      <Star className={`w-5 h-5 ${property.is_featured ? 'fill-[#b98f42] text-[#b98f42]' : ''}`} />
                    </IconButton>
                  )}
                  {can('properties.delete') && canEdit(property) && (
                    <IconButton title="Delete" tone="danger" onClick={() => setDeleting(property)}>
                      <Trash2 className="w-5 h-5" />
                    </IconButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination meta={meta} noun="properties" onPage={setPage} />
      </div>

      {formFor !== undefined && (
        <PropertyFormModal key={formFor ?? 'new'} propertyId={formFor} onClose={() => setFormFor(undefined)} />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete property"
        message={`Delete ${deleting?.reference_number} — ${deleting?.title_en}? Listings with viewings or deals cannot be deleted; unpublish them instead.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
        busy={busy}
      />
    </div>
  );
};

export default AdminPropertiesPage;
