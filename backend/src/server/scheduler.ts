import { runDailyRollover } from "@/services/daily";
import { reassignStaleLeads } from "@/services/leads";
import { refreshAllWatermarksInBackground } from "@/services/photo-watermark-job";
import { expireUnpaidReservations } from "@/services/reservations";

/**
 * In-process scheduler (started from instrumentation.ts when the Node server boots).
 *
 * Every minute it calls runDailyRollover(), which is a cheap no-op once today's rollover
 * has run, and does the real work right after midnight in the business time zone. Because
 * the rollover is idempotent and guarded by a database row, it is safe with several
 * instances, after restarts and alongside the external cron endpoint.
 *
 * Every 5 minutes it also applies the 24-hour lead rule (reassignStaleLeads): leads still New
 * with an agent after Settings.leadAutoReassignHours move to the admin; unpaid reservations past
 * their pay-by time are released.
 *
 * Every minute it also re-renders listing photos whose watermark is out of date (after the
 * watermark settings changed, or photos uploaded before watermarking), a batch at a time.
 *
 * Disable with SCHEDULER_ENABLED=false when an external cron calls
 * POST /api/cron/daily-rollover instead (e.g. serverless hosting).
 */
const g = globalThis as unknown as { __eliteScheduler?: NodeJS.Timeout; __eliteLeadCheckAt?: number };
const LEAD_CHECK_MS = 5 * 60_000;

export function startScheduler(intervalMs = 60_000) {
  if (g.__eliteScheduler) return;
  const tick = async () => {
    try {
      const result = await runDailyRollover();
      if (!result.skipped) console.log(`[scheduler] daily rollover for ${result.date}:`, JSON.stringify({ finalized: result.finalized, generated: result.generated }));
    } catch (error) {
      console.error("[scheduler] daily rollover failed", error);
    }
    refreshAllWatermarksInBackground();
    if (Date.now() - (g.__eliteLeadCheckAt ?? 0) >= LEAD_CHECK_MS) {
      g.__eliteLeadCheckAt = Date.now();
      try {
        const moved = await reassignStaleLeads();
        if (moved.moved) console.log(`[scheduler] moved ${moved.moved} untouched new lead(s) to ${moved.to}`);
        const expired = await expireUnpaidReservations();
        if (expired) console.log(`[scheduler] released ${expired} unpaid reservation(s)`);
      } catch (error) {
        console.error("[scheduler] lead / reservation checks failed", error);
      }
    }
  };
  setTimeout(tick, 3_000).unref?.();
  g.__eliteScheduler = setInterval(tick, intervalMs);
  g.__eliteScheduler.unref?.();
  console.log("[scheduler] started (daily rollover every minute, 24-hour lead rule every 5 minutes)");
}
