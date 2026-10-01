/**
 * Finalizes daily reports for past business days that have none yet (e.g. after importing
 * history or on a fresh install). Never touches days that are already finalized.
 *
 *   npm run reports:backfill -- 30      (last 30 days, default 14)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { businessDate, datesBetween, shiftDate } from "@/lib/business-day";
import { finalizeDay } from "@/services/daily";

async function main() {
  const days = Math.min(400, Math.max(1, Number(process.argv[2]) || 14));
  const yesterday = shiftDate(businessDate(), -1);
  const result: Record<string, number> = {};
  for (const date of datesBetween(shiftDate(yesterday, -(days - 1)), yesterday)) result[date] = await finalizeDay(date);
  console.log(`Finalized reports (agents per day): ${JSON.stringify(result)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
