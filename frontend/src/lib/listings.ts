/**
 * Property listings for the website, read from the CRM (agent app, app.eliterealestate.qa).
 *
 * The CRM is the single source of truth: every listing an agent publishes there appears here.
 * Server components fetch through the CRM's public API; responses are cached under the
 * `listings` tag, which the CRM expires on every change (POST /api/revalidate), with a
 * 60-second safety net. No database access and no secrets live in this app.
 */

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

/** One listing; `undefined` = not found (404), `null` = CRM unreachable. */
export async function getListing(ref: string): Promise<Listing | null | undefined> {
  const { data, status } = await get<Listing>(`/public/properties/${encodeURIComponent(ref)}`);
  if (data) return data;
  return status === 404 ? undefined : null;
}
