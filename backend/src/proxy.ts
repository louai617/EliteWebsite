import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { corsHeaders, isAllowedOrigin } from "@/lib/cors";

/**
 * Runs before every request.
 *
 *  /api/*  CORS for the client app (http://localhost:3001 by default, see CORS_ORIGINS):
 *          answers preflight requests and adds CORS headers for allowed origins only.
 *          Authentication and authorization happen in each route handler (lib/api/handler.ts).
 *  pages   Optimistic guard: bounce requests without a session cookie to /login before any
 *          rendering. The real check (session lookup, expiry, deactivation, role) runs in the
 *          CRM layout and in every Server Action.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const allowed = isAllowedOrigin(origin);
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: allowed ? 204 : 403, headers: allowed ? corsHeaders(origin!) : { Vary: "Origin" } });
    }
    const response = NextResponse.next();
    if (allowed) for (const [k, v] of Object.entries(corsHeaders(origin!))) response.headers.set(k, v);
    else response.headers.set("Vary", "Origin");
    return response;
  }

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
