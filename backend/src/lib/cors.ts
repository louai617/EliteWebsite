/**
 * CORS policy for /api/*. Imported by the proxy (no server-only deps).
 *
 * Only origins listed in CORS_ORIGINS (default: CLIENT_APP_URL, i.e. http://localhost:3001)
 * may call the API with credentials. Requests from other origins get no CORS headers, so the
 * browser blocks them.
 */
function normalize(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

export function allowedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS ?? "").split(",").map(normalize).filter(Boolean);
  if (configured.length) return configured;
  return [normalize(process.env.CLIENT_APP_URL ?? "http://localhost:3001")];
}

export function isAllowedOrigin(origin: string | null | undefined) {
  return Boolean(origin && allowedOrigins().includes(normalize(origin)));
}

/** This app's public origin (APP_URL), e.g. https://app.eliterealestate.qa; empty when unset. */
function configuredAppOrigin() {
  return normalize(process.env.APP_URL ?? "");
}

/** The origin a request reached us on, as the browser sees it. */
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  // Behind a reverse proxy (nginx) request.url keeps the address Next listens on
  // (http://127.0.0.1:3002); the public host and scheme arrive in these headers.
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const proto = (request.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim() || url.protocol.replace(":", "");
  return host ? normalize(`${proto}://${host}`) : url.origin;
}

/**
 * Whether `origin` (a browser's Origin header) is this app itself. A cross-site page can't
 * forge the Host header its request is sent with, so the header-based origin is as safe for
 * this check as request.url — it just also works behind a proxy.
 */
export function isSelfOrigin(request: Request, origin: string) {
  const o = normalize(origin);
  return o === new URL(request.url).origin || o === requestOrigin(request) || (configuredAppOrigin() !== "" && o === configuredAppOrigin());
}

export const CORS_ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
export const CORS_ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With";

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": CORS_ALLOWED_METHODS,
    "Access-Control-Allow-Headers": CORS_ALLOWED_HEADERS,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
