import "server-only";
import { ListingError } from "./types";

const TIMEOUT_MS = 30_000;
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Downloads a JSON listing feed. Accepts a top-level array or an object wrapping it
 * (`listings`, `data`, `items`, `results`, `list.property`). XML feeds must be converted
 * to JSON first (see README → Integrations). Errors are rewritten into readable messages;
 * the feed URL and API key never appear in them.
 */
export async function fetchJsonFeed(label: string, url: string, apiKey?: string): Promise<unknown[]> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new ListingError(`${label} feed could not be reached (${error instanceof Error && error.name === "TimeoutError" ? "timed out" : "network error"}).`);
  }
  if (response.status === 401 || response.status === 403) throw new ListingError(`${label} rejected the credentials (HTTP ${response.status}). Check the API key.`);
  if (!response.ok) throw new ListingError(`${label} feed returned HTTP ${response.status}.`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new ListingError(`${label} feed is too large (${Math.round(length / 1_048_576)} MB).`);
  const type = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (body.length > MAX_BYTES) throw new ListingError(`${label} feed is too large.`);
  if (/xml/i.test(type) || body.trimStart().startsWith("<")) {
    throw new ListingError(`${label} returned XML. Only JSON feeds are supported right now — convert the XML feed to JSON and upload it, or point the feed URL at a JSON export.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ListingError(`${label} feed is not valid JSON.`);
  }
  return unwrapListings(parsed);
}

/** Finds the listing array inside common feed envelopes. */
export function unwrapListings(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const key of ["listings", "data", "items", "results", "properties", "ads"]) {
      if (Array.isArray(p[key])) return p[key] as unknown[];
      if (p[key] && typeof p[key] === "object") {
        const inner = unwrapListings(p[key]);
        if (inner.length) return inner;
      }
    }
    if (p.list && typeof p.list === "object") {
      const property = (p.list as Record<string, unknown>).property;
      if (Array.isArray(property)) return property;
      if (property && typeof property === "object") return [property];
    }
  }
  throw new ListingError("Couldn't find a list of listings in the payload. Expected an array, or an object with a `listings`/`data`/`items` array.");
}
