/**
 * Runs the daily rollover once from the command line (finalize past days, generate today's
 * daily tasks). Useful for a system cron when the web server's scheduler is disabled:
 *
 *   npm run cron:daily
 */
import "dotenv/config";
import { runDailyRollover } from "@/services/daily";
import { db } from "@/lib/db";

runDailyRollover()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
