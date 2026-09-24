import 'server-only';
import mongoose from 'mongoose';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';
import { connectToDatabase } from './db';

/**
 * Uniform JSON responses for every API route:
 *
 *   { success: true,  data, meta? }
 *   { success: false, message, error: { code, details? } }
 *
 * `message` sits at the top level because the existing login/register pages
 * already read `err.response.data.message`.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Please sign in to continue.') =>
  new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have permission to do that.') =>
  new ApiError(403, 'forbidden', message);
export const notFound = (what = 'Record') => new ApiError(404, 'not_found', `${what} not found.`);
export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, 'conflict', message, details);
export const tooManyRequests = (message = 'Too many requests. Please try again shortly.') =>
  new ApiError(429, 'rate_limited', message);

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function ok<T>(data: T, init?: { status?: number; meta?: PageMeta | Record<string, unknown> }) {
  return NextResponse.json(
    { success: true, data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200, headers: { 'Cache-Control': 'no-store' } }
  );
}

function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, message, error: { code, ...(details ? { details } : {}) } },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

interface MongoServerErrorLike {
  code?: number;
  keyValue?: Record<string, unknown>;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    const fields = error.flatten().fieldErrors;
    const first = error.issues[0];
    const path = first?.path.join('.');
    return fail(400, 'validation_error', path ? `${path}: ${first.message}` : first?.message ?? 'Invalid input', fields);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(error.errors).map(([path, err]) => [path, [err.message]])
    );
    const first = Object.values(error.errors)[0];
    return fail(400, 'validation_error', first?.message ?? 'Invalid input', details);
  }

  if (error instanceof mongoose.Error.CastError) {
    return fail(400, 'invalid_value', `Invalid value for ${error.path}.`);
  }

  const mongoError = error as MongoServerErrorLike;
  if (mongoError?.code === 11000) {
    const field = Object.keys(mongoError.keyValue ?? {})[0] ?? 'field';
    return fail(409, 'duplicate', `A record with this ${field.replace(/_/g, ' ')} already exists.`, { field });
  }

  if (error instanceof SyntaxError) {
    return fail(400, 'invalid_json', 'Request body must be valid JSON.');
  }

  // Unknown failure: log the details server-side, never leak them to the client.
  console.error('[api] Unhandled error:', error);
  const isDbDown =
    error instanceof Error &&
    /MONGODB_URI|ECONNREFUSED|ServerSelection|querySrv|ENOTFOUND/i.test(`${error.name} ${error.message}`);
  return fail(
    isDbDown ? 503 : 500,
    isDbDown ? 'database_unavailable' : 'internal_error',
    isDbDown ? 'The database is currently unavailable.' : 'Something went wrong. Please try again.'
  );
}

/**
 * Reject cross-site state-changing requests. The session cookie is already
 * SameSite=Lax; this is a second, explicit check on the Origin header.
 */
function assertSameOrigin(request: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if (!origin) return; // Non-browser clients (curl, server-to-server) do not send Origin.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden('Invalid request origin.');
  }
  if (originHost !== host) throw forbidden('Cross-site requests are not allowed.');
}

type Handler<C> = (request: NextRequest, context: C) => Promise<Response>;

/** Wrap a route handler: origin check, DB connection, and error → JSON mapping. */
export function apiHandler<C = { params: Promise<Record<string, string>> }>(fn: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      await connectToDatabase();
      return await fn(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

const MAX_BODY_BYTES = 1_000_000;

/** Parse and validate a JSON body. Unknown keys are stripped by the schema. */
export async function readBody<T>(request: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request body is too large.');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request body is too large.');
  const json = text ? JSON.parse(text) : {};
  return schema.parse(json);
}

/** Validate query-string parameters against a schema. */
export function readQuery<T>(request: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): T {
  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}

/** Validate a route `[id]` param as an ObjectId (400 instead of a CastError deep in a query). */
export async function readId(context: { params: Promise<Record<string, string>> }): Promise<mongoose.Types.ObjectId> {
  const { id } = await context.params;
  if (!id || !mongoose.isValidObjectId(id) || !/^[a-f\d]{24}$/i.test(id)) {
    throw badRequest('Invalid id.');
  }
  return new mongoose.Types.ObjectId(id);
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Escape user input before using it inside a RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
