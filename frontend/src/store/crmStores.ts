'use client';

import { create } from 'zustand';
import api, { apiErrorMessage } from '@/lib/api';
import { humanize } from '@/lib/shared/constants';
import type {
  ClientRow,
  CrmSettingsData,
  DealRow,
  LeadRow,
  PropertyRow,
  TaskRow,
  UserRow,
  ViewingRow,
} from '@/lib/shared/types';
import { createResourceStore } from './createResourceStore';

export const useLeadsStore = createResourceStore<LeadRow>('/leads', { sort: '-created_at' });
export const useClientsStore = createResourceStore<ClientRow>('/clients', { sort: '-created_at' });
export const usePropertiesStore = createResourceStore<PropertyRow>('/properties', { sort: '-created_at' });
export const useViewingsStore = createResourceStore<ViewingRow>('/viewings', { sort: 'scheduled_at', upcoming: true });
export const useDealsStore = createResourceStore<DealRow>('/deals', { sort: '-created_at' });
export const useTasksStore = createResourceStore<TaskRow>('/tasks', { sort: 'due_at', completed: false });
export const useUsersStore = createResourceStore<UserRow>('/users', { sort: 'full_name', limit: 50 });

interface SettingsState {
  settings: CrmSettingsData | null;
  loading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<CrmSettingsData | null>;
  save: (patch: Partial<CrmSettingsData>) => Promise<CrmSettingsData>;
  statusLabel: (key?: string) => string;
  statusColor: (key?: string) => string;
  sourceLabel: (key?: string) => string;
  typeLabel: (key?: string) => string;
}

/** CRM settings (statuses, sources, locations, types) — loaded once and shared by every page. */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,

  load: async (force = false) => {
    if ((get().settings && !force) || get().loading) return get().settings;
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<{ data: CrmSettingsData }>('/settings');
      set({ settings: data.data, loading: false });
      return data.data;
    } catch (error) {
      set({ loading: false, error: apiErrorMessage(error) });
      return null;
    }
  },

  save: async (patch) => {
    const { data } = await api.put<{ data: CrmSettingsData }>('/settings', patch);
    set({ settings: data.data });
    return data.data;
  },

  statusLabel: (key) => get().settings?.lead_statuses.find((s) => s.key === key)?.label ?? humanize(key),
  statusColor: (key) => get().settings?.lead_statuses.find((s) => s.key === key)?.color ?? 'gray',
  sourceLabel: (key) => get().settings?.lead_sources.find((s) => s.key === key)?.label ?? humanize(key),
  typeLabel: (key) => get().settings?.property_types.find((t) => t.key === key)?.label_en ?? humanize(key),
}));
