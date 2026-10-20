import { watch } from "node:fs";
import path from "node:path";
// Plain JS so `npm run dev` can run the same logic before Next starts (scripts/db-sync.mjs).
import { syncDatabase } from "../../scripts/db-sync.mjs";

/**
 * Development only: brings the Prisma client and the local database up to date when the server
 * starts (however it was started), then again whenever prisma/schema.prisma or a migration
 * changes, e.g. after `git pull` while `npm run dev` is running. src/lib/db.ts swaps in a fresh
 * client as soon as the regenerated code is loaded, so no restart is needed.
 */
const g = globalThis as unknown as { __eliteDbWatch?: boolean };

function run(reason: string) {
  try {
    syncDatabase({ log: (m: string) => console.log(`${m} (${reason})`) });
  } catch (error) {
    const e = error as { stderr?: string; stdout?: string; message?: string };
    console.error(`[db] Could not update the database code (${reason}). Run \`npx prisma generate && npx prisma migrate deploy\` in backend/.\n${e.stderr || e.stdout || e.message}`);
  }
}

export function startDevDbSync() {
  if (g.__eliteDbWatch) return;
  g.__eliteDbWatch = true;
  run("server start");

  const dir = path.join(process.cwd(), "prisma");
  let timer: NodeJS.Timeout | undefined;
  try {
    watch(dir, { recursive: true }, (_event, file) => {
      const name = String(file ?? "").replaceAll("\\", "/");
      if (name !== "schema.prisma" && !name.startsWith("migrations/")) return;
      clearTimeout(timer);
      timer = setTimeout(() => run(`${name} changed`), 750);
    }).unref();
  } catch {
    // Recursive watching isn't available everywhere: the start-up check above still runs.
  }
}
