import "server-only";
import { CLIENT_APP_URL } from "@/lib/env";

/**
 * Keeps the public website (eliterealestate.qa) in step with the CRM. The website caches
 * listing data; whenever a listing, its photos or its status change here, we ask the website
 * to drop that cache so the next visitor sees the change immediately.
 *
 * Calls are debounced (one request per burst of changes, sent after the surrounding
 * transaction has committed) and never block or fail the CRM operation. Without
 * WEBSITE_REVALIDATE_SECRET the website still refreshes on its own timer (60 s).
 */

const URL = (process.env.WEBSITE_REVALIDATE_URL || `${CLIENT_APP_URL}/api/revalidate`).trim();
const SECRET = process.env.WEBSITE_REVALIDATE_SECRET?.trim() || "";
const DEBOUNCE_MS = 750;

const state = globalThis as unknown as { __websiteSyncTimer?: ReturnType<typeof setTimeout> };

export function websiteSyncEnabled() {
  return Boolean(SECRET);
}

async function send() {
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ tags: ["listings"] }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.warn(`[website-sync] website answered HTTP ${res.status}`);
  } catch {
    // Website offline — it falls back to its time-based refresh.
  }
}

/** Ask the website to refresh its listings right away (for scripts, which exit before a debounce). */
export async function refreshWebsiteNow() {
  if (!SECRET || process.env.NODE_ENV === "test") return;
  await send();
}

/** Ask the website to refresh its listings (debounced, fire-and-forget). */
export function notifyWebsite() {
  if (!SECRET || process.env.NODE_ENV === "test") return;
  if (state.__websiteSyncTimer) clearTimeout(state.__websiteSyncTimer);
  state.__websiteSyncTimer = setTimeout(() => {
    state.__websiteSyncTimer = undefined;
    void send();
  }, DEBOUNCE_MS);
}
