import axios, { AxiosError } from 'axios';

/**
 * Browser → CRM API client.
 *
 * The API lives in this same Next.js app (`/api/*`). Authentication is an
 * httpOnly session cookie set by the server, so no token is ever stored in
 * localStorage or readable by JavaScript.
 */
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Notified when any request comes back 401 (session expired or revoked). */
export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    if (error.response?.status === 401 && !url.startsWith('/auth/')) {
      unauthorizedListeners.forEach((listener) => listener());
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from an API error (falls back to a generic one). */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (!error.response) return 'Cannot reach the server. Check your connection.';
  }
  return fallback;
}

/** Field-level validation errors from a 400 response, if any. */
export function apiFieldErrors(error: unknown): Record<string, string[]> {
  if (axios.isAxiosError(error)) {
    const details = (error.response?.data as { error?: { details?: unknown } } | undefined)?.error?.details;
    if (details && typeof details === 'object') return details as Record<string, string[]>;
  }
  return {};
}

export default api;
