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
