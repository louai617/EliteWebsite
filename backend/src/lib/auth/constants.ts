/** Shared by the proxy (edge of the request) and the server session code. */
export const SESSION_COOKIE = "elite_crm_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, sliding
export const SESSION_RENEW_WHEN_LEFT_MS = 24 * 60 * 60 * 1000;
