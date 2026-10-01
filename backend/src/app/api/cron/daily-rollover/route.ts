import { timingSafeEqual } from "node:crypto";
import { apiError, apiOk } from "@/lib/api/response";
import { CRON_SECRET } from "@/lib/env";
import { runDailyRollover } from "@/services/daily";

/**
 * POST /api/cron/daily-rollover — for external schedulers (system cron, Vercel Cron,
 * GitHub Actions…). Requires `Authorization: Bearer <CRON_SECRET>`. Idempotent: calling it
 * more than once per day does nothing after the first successful run.
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
    return apiOk(await runDailyRollover());
  } catch (error) {
    console.error("[cron] daily rollover failed", error);
    return apiError("INTERNAL", "Daily rollover failed. Check the server logs.");
  }
}
