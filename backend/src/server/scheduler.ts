import { runDailyRollover } from "@/services/daily";

/**
 * In-process scheduler (started from instrumentation.ts when the Node server boots).
 *
 * Every minute it calls runDailyRollover(), which is a cheap no-op once today's rollover
 * has run, and does the real work right after midnight in the business time zone. Because
 * the rollover is idempotent and guarded by a database row, it is safe with several
 * instances, after restarts and alongside the external cron endpoint.
 *
 * Disable with SCHEDULER_ENABLED=false when an external cron calls
 * POST /api/cron/daily-rollover instead (e.g. serverless hosting).
 */
const g = globalThis as unknown as { __eliteScheduler?: NodeJS.Timeout };

export function startScheduler(intervalMs = 60_000) {
  if (g.__eliteScheduler) return;
  const tick = async () => {
    try {
      const result = await runDailyRollover();
      if (!result.skipped) console.log(`[scheduler] daily rollover for ${result.date}:`, JSON.stringify({ finalized: result.finalized, generated: result.generated }));
    } catch (error) {
      console.error("[scheduler] daily rollover failed", error);
    }
  };
  setTimeout(tick, 3_000).unref?.();
  g.__eliteScheduler = setInterval(tick, intervalMs);
  g.__eliteScheduler.unref?.();
  console.log("[scheduler] started (daily rollover check every minute)");
}
