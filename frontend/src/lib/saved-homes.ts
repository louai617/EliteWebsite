'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Saved homes, kept in the visitor's own browser (localStorage). The website has no visitor
 * accounts, so nothing is sent to the server: the hearts on cards and listing pages and the
 * Saved homes page (/saved) all read this list. It syncs across open tabs.
 */

const KEY = 'elite.saved-homes.v1';
const EVENT = 'elite:saved-homes';
const MAX = 48;
const EMPTY: string[] = [];

let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY;

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.length <= 40).slice(0, MAX) : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function write(list: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Private mode / storage blocked: the heart simply won't stick.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useSavedHomes() {
  const refs = useSyncExternalStore(subscribe, read, () => EMPTY);
  const set = useMemo(() => new Set(refs), [refs]);
  const toggle = useCallback((ref: string) => {
    const current = read();
    write(current.includes(ref) ? current.filter((r) => r !== ref) : [ref, ...current]);
  }, []);
  const remove = useCallback((ref: string) => write(read().filter((r) => r !== ref)), []);
  return { refs, count: refs.length, isSaved: (ref: string) => set.has(ref), toggle, remove };
}
