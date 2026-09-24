'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { create } from 'zustand';
import api from '@/lib/api';
import type { AgentRef } from '@/lib/shared/types';
import { cn, inputClass } from './ui';

export interface PickerOption {
  _id: string;
  label: string;
  sublabel?: string;
}

type Resource = 'properties' | 'leads' | 'clients';

const toOption: Record<Resource, (row: Record<string, unknown>) => PickerOption> = {
  properties: (row) => ({
    _id: String(row._id),
    label: String(row.title_en ?? ''),
    sublabel: [row.reference_number, (row.location as { area_en?: string } | undefined)?.area_en].filter(Boolean).join(' · '),
  }),
  leads: (row) => ({ _id: String(row._id), label: String(row.full_name ?? ''), sublabel: String(row.phone ?? row.email ?? '') }),
  clients: (row) => ({ _id: String(row._id), label: String(row.full_name ?? ''), sublabel: String(row.phone ?? row.email ?? '') }),
};

/**
 * Searchable picker backed by the list API (server-side search, 8 results) —
 * never loads a whole collection into the browser.
 */
export function EntityPicker({
  resource,
  value,
  initial,
  onChange,
  placeholder,
}: {
  resource: Resource;
  value: string | null | undefined;
  /** Label for the current value (from the populated record). */
  initial?: PickerOption | null;
  onChange: (id: string | null, option: PickerOption | null) => void;
  placeholder: string;
}) {
  const [selected, setSelected] = useState<PickerOption | null>(initial ?? null);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const current = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get<{ data: Record<string, unknown>[] }>(`/${resource}`, {
          params: { q: query || undefined, limit: 8 },
        });
        if (current === seq.current) setOptions(data.data.map(toOption[resource]));
      } catch {
        if (current === seq.current) setOptions([]);
      } finally {
        if (current === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open, resource]);

  const shown = value ? selected : null;

  return (
    <div className="relative">
      {shown ? (
        <div className={cn(inputClass, 'flex items-center justify-between gap-2')}>
          <span className="truncate">
            <span className="font-medium text-gray-900">{shown.label}</span>
            {shown.sublabel && <span className="ms-2 text-xs text-gray-400">{shown.sublabel}</span>}
          </span>
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setSelected(null);
              onChange(null, null);
            }}
            className="text-gray-400 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <input
          type="search"
          className={inputClass}
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {open && !shown && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl">
          {loading && (
            <div className="flex justify-center p-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#b98f42]" />
            </div>
          )}
          {!loading && options.length === 0 && <p className="p-3 text-sm text-gray-400">No matches</p>}
          {!loading &&
            options.map((option) => (
              <button
                key={option._id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelected(option);
                  setOpen(false);
                  setQuery('');
                  onChange(option._id, option);
                }}
                className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{option.label}</span>
                {option.sublabel && <span className="ms-2 text-xs text-gray-400">{option.sublabel}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agents (small list — loaded once per session and shared)
// ---------------------------------------------------------------------------

interface AgentsState {
  agents: (AgentRef & { role?: string })[];
  loaded: boolean;
  load: () => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    try {
      const { data } = await api.get<{ data: (AgentRef & { role?: string })[] }>('/users', {
        params: { staff: true, is_active: true, limit: 100 },
      });
      set({ agents: data.data });
    } catch {
      set({ loaded: false });
    }
  },
}));

export function AgentSelect({
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = 'Unassigned',
  className,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const agents = useAgentsStore((s) => s.agents);
  const load = useAgentsStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <select className={cn(inputClass, className)} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {agents.map((agent) => (
        <option key={agent._id} value={agent._id}>
          {agent.full_name}
        </option>
      ))}
    </select>
  );
}
