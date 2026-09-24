'use client';

import { create } from 'zustand';
import api, { apiErrorMessage } from '@/lib/api';
import type { PageMeta } from '@/lib/shared/types';

export type FilterValue = string | number | boolean | undefined;
export type Filters = Record<string, FilterValue>;

export interface ResourceState<T> {
  items: T[];
  meta: PageMeta | null;
  filters: Filters;
  loading: boolean;
  error: string | null;

  /** Merge filters; resets to page 1 unless `page` is part of the change. */
  setFilters: (patch: Filters) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
  fetch: () => Promise<void>;
  create: (payload: Record<string, unknown>) => Promise<T>;
  update: (id: string, payload: Record<string, unknown>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

/**
 * Zustand store for one CRM collection (leads, clients, properties…).
 * Lists are always fetched from the API with the current filters — the store
 * never holds more than one page, so large collections stay cheap.
 */
export function createResourceStore<T extends { _id: string }>(endpoint: string, defaultFilters: Filters = {}) {
  const initialFilters: Filters = { page: 1, limit: 20, ...defaultFilters };
  let requestSeq = 0;

  return create<ResourceState<T>>((set, get) => ({
    items: [],
    meta: null,
    filters: initialFilters,
    loading: false,
    error: null,

    setFilters: (patch) => {
      const next = { ...get().filters, ...patch };
      if (!('page' in patch)) next.page = 1;
      set({ filters: next });
      void get().fetch();
    },

    setPage: (page) => get().setFilters({ page }),

    resetFilters: () => {
      set({ filters: initialFilters });
      void get().fetch();
    },

    fetch: async () => {
      const seq = ++requestSeq;
      set({ loading: true, error: null });
      const params = Object.fromEntries(
        Object.entries(get().filters).filter(([, v]) => v !== undefined && v !== '')
      );
      try {
        const { data } = await api.get<{ data: T[]; meta: PageMeta }>(endpoint, { params });
        // Ignore responses that arrive after a newer request (fast typing in search).
        if (seq !== requestSeq) return;
        set({ items: data.data, meta: data.meta, loading: false });
      } catch (error) {
        if (seq !== requestSeq) return;
        set({ loading: false, error: apiErrorMessage(error) });
      }
    },

    create: async (payload) => {
      const { data } = await api.post<{ data: T }>(endpoint, payload);
      await get().fetch();
      return data.data;
    },

    update: async (id, payload) => {
      const { data } = await api.patch<{ data: T }>(`${endpoint}/${id}`, payload);
      // Patch in place so the row updates instantly, then refresh counts/order.
      set({ items: get().items.map((item) => (item._id === id ? { ...item, ...data.data } : item)) });
      void get().fetch();
      return data.data;
    },

    remove: async (id) => {
      await api.delete(`${endpoint}/${id}`);
      set({ items: get().items.filter((item) => item._id !== id) });
      await get().fetch();
    },
  }));
}
