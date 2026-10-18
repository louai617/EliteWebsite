/**
 * Central API client for the Elite CRM backend (http://localhost:3002 by default).
 *
 * - Base URL from NEXT_PUBLIC_API_URL (public by design: it is only the API's address).
 * - The website only calls public endpoints (listings, enquiries, viewing bookings,
 *   reservations): visitors have no accounts, so no cookies or tokens are sent.
 * - Every response uses the backend envelope { ok: true, data } | { ok: false, error };
 *   failures are thrown as ApiError with a user-safe message and optional field errors.
 * - No database access or secrets live in this app — the backend owns all of that.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api').replace(/\/$/, '');
/** The agent app (CRM) — the "Agent portal" button opens its sign-in page. */
export const CRM_URL = (process.env.NEXT_PUBLIC_CRM_URL || API_URL.replace(/\/api$/, '')).replace(/\/$/, '');

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'NETWORK';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode,
    readonly status: number,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: ApiErrorCode; message: string; fields?: Record<string, string[]> } };

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      credentials: 'omit',
      // FormData (file uploads) sets its own multipart Content-Type with the boundary.
      headers: { Accept: 'application/json', ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 'NETWORK', 0);
  }

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }
  if (payload && payload.ok) return payload.data;
  if (payload && !payload.ok) throw new ApiError(payload.error.message, payload.error.code, response.status, payload.error.fields);
  throw new ApiError(response.ok ? 'Unexpected response from the server.' : `Request failed (HTTP ${response.status}).`, 'INTERNAL', response.status);
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  del: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'DELETE', body: body ?? {} }),
  /** Multipart upload (files). */
  upload: <T>(path: string, form: FormData) => apiRequest<T>(path, { method: 'POST', body: form }),
};

/** First message of an error, for forms. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  return error instanceof ApiError ? error.message : fallback;
}

export default api;
