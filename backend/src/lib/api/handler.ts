import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getCurrentUser, resolveSession, type SessionUser } from "@/lib/auth/session";
import { isAllowedOrigin } from "@/lib/cors";
import { AppError, forbidden, toPublicError } from "@/lib/errors";
import { hasPermission, isStaff, type Permission } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { zodFieldErrors } from "@/lib/action";
import { apiError, apiOk } from "./response";

/**
 * Wraps a REST route handler with the concerns every endpoint needs, in this order:
 *
 *  1. CSRF protection — state-changing requests authenticated by the session cookie must come
 *     from the API's own origin or an allowed CORS origin (CORS_ORIGINS). Bearer-token
 *     requests are not exposed to CSRF and skip this check.
 *  2. Rate limiting (optional, per IP).
 *  3. Authentication — session cookie or `Authorization: Bearer <token>`. Roles always come
 *     from the database session, never from the request.
 *  4. Authorization — `audience` (staff / client / any) and an optional `permission` from
 *     the central matrix in lib/permissions.ts.
 *  5. Validation — JSON body and query string through Zod schemas.
 *  6. Uniform responses and error mapping (lib/api/response.ts); internal errors are logged,
 *     never leaked.
 */

type Audience = "public" | "authenticated" | "staff" | "client";

interface RouteOptions<B extends z.ZodType | undefined, Q extends z.ZodType | undefined> {
  audience: Audience;
  permission?: Permission;
  body?: B;
  query?: Q;
  /** Max requests per IP per window, e.g. { limit: 10, windowMs: 60_000 }. */
  rateLimit?: { limit: number; windowMs: number; key?: string };
  /** Status for a successful response (default 200). */
  status?: number;
}

type Infer<T> = T extends z.ZodType ? z.output<T> : undefined;

export interface RouteContext<B, Q, U> {
  request: Request;
  user: U;
  body: B;
  query: Q;
  params: Record<string, string>;
  /** Raw Bearer token, if the request used one. */
  bearerToken: string | null;
}

type UserFor<A extends Audience> = A extends "public" ? SessionUser | null : SessionUser;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MAX_BODY_BYTES = 5 * 1024 * 1024;


function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function bearerFrom(request: Request) {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/** Same-origin or allowed cross-origin, for cookie-authenticated writes. */
function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE; its absence means a
    // same-origin request from an old browser or a non-browser client (no CSRF exposure).
    const fetchSite = request.headers.get("sec-fetch-site");
    return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
  }
  const self = new URL(request.url).origin;
  return origin === self || isAllowedOrigin(origin);
}

async function parseBody(request: Request) {
  if (!MUTATING.has(request.method)) return undefined;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new AppError("Request body is too large.", "VALIDATION");
  const text = await request.text();
  if (!text) return undefined;
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    throw new AppError("Send the request body as JSON (Content-Type: application/json).", "VALIDATION");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("The request body is not valid JSON.", "VALIDATION");
  }
}

function queryObject(request: Request) {
  const out: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export function apiRoute<A extends Audience, B extends z.ZodType | undefined = undefined, Q extends z.ZodType | undefined = undefined, R = unknown>(
  options: RouteOptions<B, Q> & { audience: A },
  handler: (ctx: RouteContext<Infer<B>, Infer<Q>, UserFor<A>>) => Promise<R>,
) {
  return async (request: Request, routeContext?: { params?: Promise<Record<string, string | string[]>> }) => {
    try {
      const bearerToken = bearerFrom(request);
      const usesCookie = !bearerToken && (await cookies()).has(SESSION_COOKIE);

      if (MUTATING.has(request.method) && usesCookie && !originAllowed(request)) {
        throw forbidden("Cross-origin request blocked.");
      }

      if (options.rateLimit) {
        const key = `${options.rateLimit.key ?? new URL(request.url).pathname}:${clientIp(request)}`;
        const result = rateLimit(key, options.rateLimit.limit, options.rateLimit.windowMs);
        if (!result.ok) {
          return apiError("RATE_LIMITED", `Too many requests. Try again in ${Math.ceil(result.retryAfterMs / 1000)} seconds.`, undefined, {
            "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
          });
        }
      }

      const user = bearerToken ? await resolveSession(bearerToken) : await getCurrentUser();
      if (options.audience !== "public" && !user) throw new AppError("Please sign in to continue.", "UNAUTHORIZED");
      if (user) {
        if (options.audience === "staff" && !isStaff(user)) throw forbidden();
        if (options.audience === "client" && !hasPermission(user, "portal.access")) throw forbidden("This endpoint is for client accounts.");
      }
      if (options.permission && (!user || !hasPermission(user, options.permission))) throw forbidden();

      const rawBody = await parseBody(request);
      let body: unknown = undefined;
      if (options.body) {
        const parsed = options.body.safeParse(rawBody ?? {});
        if (!parsed.success) return apiError("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error));
        body = parsed.data;
      }
      let query: unknown = undefined;
      if (options.query) {
        const parsed = options.query.safeParse(queryObject(request));
        if (!parsed.success) return apiError("VALIDATION", "Invalid query parameters.", zodFieldErrors(parsed.error));
        query = parsed.data;
      }

      const rawParams = (await routeContext?.params) ?? {};
      const params = Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v.join("/") : v]));

      const data = await handler({
        request,
        user: user as UserFor<A>,
        body: body as Infer<B>,
        query: query as Infer<Q>,
        params,
        bearerToken,
      });
      if (data instanceof Response) return data;
      return apiOk(data ?? null, options.status ?? 200);
    } catch (error) {
      const { code, message, fieldErrors } = toPublicError(error);
      return apiError(code, message, fieldErrors);
    }
  };
}

/** Pagination/search query shared by list endpoints. */
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
});
