/**
 * Property listings for the website, read from the CRM (agent app, app.eliterealestate.qa).
 *
 * The CRM is the single source of truth: every listing an agent publishes there appears here.
 * Server components fetch through the CRM's public API; responses are cached under the
 * `listings` tag, which the CRM expires on every change (POST /api/revalidate), with a
 * 60-second safety net. No database access and no secrets live in this app.
 */

import { unstable_cache } from 'next/cache';
import type { Listing, ListingPage, ListingQuery } from './listing-types';

export * from './listing-types';

/** Server-side base URL of the CRM API (an internal address can be used in production). */
const API = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api').replace(/\/$/, '');

export const LISTINGS_TAG = 'listings';
const REVALIDATE_SECONDS = 60;

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

async function get<T>(path: string): Promise<{ data: T | null; status: number }> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Accept: 'application/json' },
      next: { tags: [LISTINGS_TAG], revalidate: REVALIDATE_SECONDS },
    });
    const body = (await res.json()) as Envelope<T>;
    return { data: body.ok ? body.data : null, status: res.status };
  } catch (error) {
    console.error(`[listings] CRM API unreachable (${API}${path})`, error instanceof Error ? error.message : error);
    return { data: null, status: 0 };
  }
}

function qs(query: ListingQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** A page of listings; `null` when the CRM can't be reached (the page shows a friendly error). */
export async function getListings(query: ListingQuery = {}): Promise<ListingPage | null> {
  return (await get<ListingPage>(`/public/properties${qs(query)}`)).data;
}

/**
 * One listing, cached as a value rather than as a fetch response: Next only caches 200
 * responses, so a sold / unpublished / deleted listing would keep showing from the cache
 * whenever the CRM's refresh call is missed (website down, secret not set). Cached this way,
 * "not found" is stored too and the page disappears on the next refresh. Outages throw, so they
 * are never cached and the last good copy stays.
 */
const fetchListing = unstable_cache(
  async (ref: string): Promise<{ found: true; listing: Listing } | { found: false }> => {
    const res = await fetch(`${API}/public/properties/${encodeURIComponent(ref)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (res.status === 404) return { found: false };
    const body = (await res.json()) as Envelope<Listing>;
    if (!res.ok || !body.ok) throw new Error(`HTTP ${res.status}`);
    return { found: true, listing: body.data };
  },
  ['listing-detail'],
  { tags: [LISTINGS_TAG], revalidate: REVALIDATE_SECONDS },
);

/** One listing; `undefined` = not found (404), `null` = CRM unreachable. */
export async function getListing(ref: string): Promise<Listing | null | undefined> {
  try {
    const result = await fetchListing(ref);
    return result.found ? result.listing : undefined;
  } catch (error) {
    console.error(`[listings] CRM API unreachable (${API}/public/properties/${ref})`, error instanceof Error ? error.message : error);
    return null;
  }
}
