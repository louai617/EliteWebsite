import { timingSafeEqual } from "node:crypto";
import { apiError, apiOk } from "@/lib/api/response";
import { CRON_SECRET } from "@/lib/env";
import { runDailyRollover } from "@/services/daily";
import { reassignStaleLeads } from "@/services/leads";
import { expireUnpaidReservations } from "@/services/reservations";

/**
 * POST /api/cron/daily-rollover — for external schedulers (system cron, Vercel Cron,
 * GitHub Actions…). Requires `Authorization: Bearer <CRON_SECRET>`. Idempotent: calling it
 * more than once per day does nothing after the first successful run. Also applies the 24-hour
 * lead rule, so call it every few minutes when the in-process scheduler is disabled.
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://crm.example.com/api/cron/daily-rollover
 */
export async function POST(request: Request) {
  if (!CRON_SECRET) return apiError("NOT_FOUND", "Cron endpoint is disabled (CRON_SECRET is not set).");
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(CRON_SECRET);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return apiError("UNAUTHORIZED", "Invalid cron secret.");
  try {
    const rollover = await runDailyRollover();
    const leads = await reassignStaleLeads();
    const reservationsReleased = await expireUnpaidReservations();
    return apiOk({ ...rollover, leadsReassigned: leads.moved, reservationsReleased });
  } catch (error) {
    console.error("[cron] daily rollover failed", error);
    return apiError("INTERNAL", "Daily rollover failed. Check the server logs.");
  }
}
