'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { LEAD_STATUS_CATEGORIES, humanize } from '@/lib/shared/constants';
import type { CrmSettingsData } from '@/lib/shared/types';
import { useSettingsStore } from '@/store/crmStores';
import { Badge, BADGE_COLOR_NAMES, Card, ErrorBanner, PageHeader, PrimaryButton, inputClass } from '@/components/dashboard/ui';

type Row = Record<string, string> & { key: string; __new?: string };

interface Column {
  field: string;
  label: string;
  options?: readonly string[];
  width?: string;
  dir?: 'rtl';
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

/** Edit one configurable list. Keys are locked once saved so existing records keep pointing at them. */
function ListEditor({
  title,
  description,
  section,
  columns,
  labelField,
  initial,
}: {
  title: string;
  description: string;
  section: keyof Omit<CrmSettingsData, 'ai_config'>;
  columns: Column[];
  labelField: string;
  initial: Row[];
}) {
  const save = useSettingsStore((s) => s.save);
  const [rows, setRows] = useState<Row[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = (index: number, field: string, value: string) =>
    setRows((list) =>
      list.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        // New rows derive their key from the label until saved.
        if (row.__new && field === labelField) next.key = slug(value);
        return next;
      })
    );

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const clean = rows.map((row) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(row)) if (k !== '__new' && v !== '') out[k] = v;
        return out;
      });
      const result = await save({ [section]: clean } as Partial<CrmSettingsData>);
      setRows((result[section] as unknown as Row[]).map((r) => ({ ...r })));
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const blank = (): Row => {
    const row: Row = { key: '', __new: '1' };
    for (const c of columns) row[c.field] = c.options ? c.options[0] : '';
    return row;
  };

  return (
    <Card className="p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-bold text-green-600">Saved</span>}
          <button type="button" onClick={() => setRows((list) => [...list, blank()])} className="flex items-center gap-2 text-sm font-bold text-[#b98f42] hover:underline">
            <Plus className="h-4 w-4" /> Add
          </button>
          <PrimaryButton onClick={onSave} loading={saving} className="px-4 py-2 text-sm">
            <Save className="h-4 w-4" /> Save
          </PrimaryButton>
        </div>
      </div>
      <ErrorBanner message={error} onClose={() => setError(null)} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Key</th>
              {columns.map((c) => (
                <th key={c.field} className="px-2 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-400">{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.key}-${index}`}>
                <td className="w-44 px-2 py-1.5">
                  <input
                    className={`${inputClass} py-2 font-mono text-xs`}
                    value={row.key}
                    disabled={!row.__new}
                    title={row.__new ? undefined : 'Keys cannot change once saved'}
                    onChange={(e) => update(index, 'key', slug(e.target.value))}
                  />
                </td>
                {columns.map((c) => (
                  <td key={c.field} className={`px-2 py-1.5 ${c.width ?? ''}`}>
                    {c.options ? (
                      <select className={`${inputClass} py-2`} value={row[c.field] ?? ''} onChange={(e) => update(index, c.field, e.target.value)}>
                        {c.options.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
                      </select>
                    ) : (
                      <input dir={c.dir} className={`${inputClass} py-2`} value={row[c.field] ?? ''} onChange={(e) => update(index, c.field, e.target.value)} />
                    )}
                  </td>
                ))}
                <td className="w-10 px-2 py-1.5 text-right">
                  <button type="button" aria-label="Remove" onClick={() => setRows((list) => list.filter((_, i) => i !== index))} className="p-2 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  const error = useSettingsStore((s) => s.error);

  useEffect(() => {
    void load(true);
  }, [load]);

  if (!settings) {
    return <ErrorBanner message={error} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Configure the lists your CRM uses. Changes apply immediately for everyone." />

      <ListEditor
        title="Lead statuses"
        description="Pipeline stages, in order. The first 'open' status is where new leads start; 'won' counts as converted."
        section="lead_statuses"
        labelField="label"
        initial={settings.lead_statuses.map((s) => ({ ...s }))}
        columns={[
          { field: 'label', label: 'Label' },
          { field: 'category', label: 'Category', options: LEAD_STATUS_CATEGORIES },
          { field: 'color', label: 'Color', options: BADGE_COLOR_NAMES },
        ]}
      />
      <div className="-mt-4 flex flex-wrap gap-2 px-2">
        {settings.lead_statuses.map((s) => <Badge key={s.key} color={s.color}>{s.label}</Badge>)}
      </div>

      <ListEditor
        title="Lead sources"
        description="Where leads come from."
        section="lead_sources"
        labelField="label"
        initial={settings.lead_sources.map((s) => ({ ...s }))}
        columns={[{ field: 'label', label: 'Label' }]}
      />

      <ListEditor
        title="Locations"
        description="Areas offered in property and lead forms and on public listings."
        section="locations"
        labelField="name_en"
        initial={settings.locations.map((l) => ({ ...l }))}
        columns={[
          { field: 'name_en', label: 'Name' },
          { field: 'name_ar', label: 'Arabic', dir: 'rtl' },
          { field: 'city_en', label: 'City' },
          { field: 'city_ar', label: 'City (Arabic)', dir: 'rtl' },
        ]}
      />

      <ListEditor
        title="Property types"
        description="Types available for listings. A type in use by a listing cannot be removed."
        section="property_types"
        labelField="label_en"
        initial={settings.property_types.map((t) => ({ ...t }))}
        columns={[
          { field: 'label_en', label: 'Label' },
          { field: 'label_ar', label: 'Arabic', dir: 'rtl' },
        ]}
      />
    </div>
  );
}
