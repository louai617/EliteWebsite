/**
 * The single response format of the REST API.
 *
 *   200/201  { "ok": true,  "data": … }
 *   4xx/5xx  { "ok": false, "error": { "code": "VALIDATION", "message": "…", "fields": { … } } }
 *
 * Shared with the client app as a type contract (frontend/src/lib/api.ts mirrors it).
 */
import type { AppErrorCode } from "@/lib/errors";

export type ApiErrorCode = AppErrorCode | "INTERNAL" | "BAD_REQUEST" | "METHOD_NOT_ALLOWED";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: { code: ApiErrorCode; message: string; fields?: Record<string, string[]> };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

const NO_STORE = { "Cache-Control": "private, no-store" };

export function apiOk<T>(data: T, status = 200, headers: Record<string, string> = {}) {
  return Response.json({ ok: true, data } satisfies ApiSuccess<T>, { status, headers: { ...NO_STORE, ...headers } });
}

export function apiError(code: ApiErrorCode, message: string, fields?: Record<string, string[]>, headers: Record<string, string> = {}) {
  const body: ApiFailure = { ok: false, error: { code, message, ...(fields ? { fields } : {}) } };
  return Response.json(body, { status: STATUS_BY_CODE[code], headers: { ...NO_STORE, ...headers } });
}
