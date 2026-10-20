/** Runs once when the server starts. */
export async function register() {
  // Render dates in Doha time unless the host overrides TZ.
  process.env.TZ ||= "Asia/Qatar";

  // Development: regenerate the Prisma client / apply migrations when the schema changed
  // (e.g. after `git pull`), at start-up and while running. Production uses `npm run db:deploy`.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "development") {
    const { startDevDbSync } = await import("./server/dev-db-sync");
    startDevDbSync();
  }

  // Daily rollover scheduler — Node.js server only, never during `next build`.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SCHEDULER_ENABLED !== "false" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startScheduler } = await import("./server/scheduler");
    startScheduler();
  }
}
