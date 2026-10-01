import "server-only";

/**
 * Server-side configuration read from the environment. Nothing in here is ever sent to the
 * browser. See .env.example for documentation of every variable.
 */

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim().replace(/\/+$/, ""))
    .filter(Boolean);

/** Public URL of the client app (website + client portal), e.g. http://localhost:3001. */
export const CLIENT_APP_URL = (process.env.CLIENT_APP_URL ?? "http://localhost:3001").replace(/\/+$/, "");

/** Where client-portal users are sent if they open the staff CRM. */
export const CLIENT_PORTAL_URL = process.env.CLIENT_PORTAL_URL ?? `${CLIENT_APP_URL}/en/dashboard`;

/**
 * Browser origins allowed to call the API with credentials (CORS). Defaults to the client app.
 * Comma-separated, e.g. "https://elite.qa,https://www.elite.qa".
 */
export function corsOrigins(): string[] {
  const configured = list(process.env.CORS_ORIGINS);
  return configured.length ? configured : [CLIENT_APP_URL];
}

/** Shared secret for the external cron trigger (POST /api/cron/daily-rollover). */
export const CRON_SECRET = process.env.CRON_SECRET ?? "";

/** Set to "false" to disable the in-process scheduler (e.g. when an external cron is used). */
export const SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED !== "false";
