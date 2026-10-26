/**
 * Keeps the local database code in step with prisma/schema.prisma, so pulling new code never
 * leaves the app on an old Prisma client ("Unknown field … for select statement") or an old
 * database ("The column … does not exist"):
 *
 *   1. regenerates the Prisma client (src/generated/prisma, not in git) when the schema or the
 *      Prisma version changed since it was last generated;
 *   2. applies pending migrations (`prisma migrate deploy`; never resets or deletes data).
 *
 * Runs before `npm run dev`; in development also when the server starts, whenever
 * prisma/schema.prisma or prisma/migrations change while it runs (src/instrumentation.ts), and
 * when src/lib/db.ts is (re)loaded, so a server that was already running when new code was
 * pulled catches up through hot reload, without a restart.
 *
 *   node scripts/db-sync.mjs               generate if needed + apply migrations
 *   node scripts/db-sync.mjs --no-migrate  generate if needed only
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const schemaPath = path.join(root, "prisma", "schema.prisma");
const generatedDir = path.join(root, "src", "generated", "prisma");
const stampPath = path.join(generatedDir, ".schema-hash");
const cli = path.join(root, "node_modules", "prisma", "build", "index.js");

function prismaVersion() {
  try {
    return JSON.parse(readFileSync(path.join(root, "node_modules", "prisma", "package.json"), "utf8")).version;
  } catch {
    return "unknown";
  }
}

function schemaHash() {
  return createHash("sha256").update(readFileSync(schemaPath)).update(prismaVersion()).digest("hex");
}

function prisma(args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: root, env: process.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Returns what it did, e.g. { generated: true, migrated: false }. Throws with Prisma's message on failure. */
export function syncDatabase({ migrate = true, log = console.log } = {}) {
  const result = { generated: false, migrated: false };
  const hash = schemaHash();
  const current = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : "";
  if (current !== hash || !existsSync(path.join(generatedDir, "client.ts"))) {
    prisma(["generate"]);
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(stampPath, `${hash}\n`);
    result.generated = true;
    log("[db] Prisma client regenerated for the current schema");
  }
  if (migrate) {
    const out = prisma(["migrate", "deploy"]);
    if (!/No pending migrations/i.test(out)) {
      result.migrated = true;
      // "└─ 20261019130005_property_photo_optimization/" lines name the applied migrations.
      const applied = [...out.matchAll(/└─ (\S+)\/\s*$/gm)].map((m) => m[1]);
      log(`[db] Applied database migration(s)${applied.length ? `: ${applied.join(", ")}` : ""}`);
    }
  }
  return result;
}

function migrationNames() {
  const dir = path.join(root, "prisma", "migrations");
  try {
    return readdirSync(dir).filter((d) => existsSync(path.join(dir, d, "migration.sql"))).sort();
  } catch {
    return [];
  }
}

const memo = globalThis;

/** Prisma's error without its boilerplate, plus the way out for a half-applied migration. */
export function explain(error) {
  const raw = String(error?.stderr || error?.stdout || error?.message || error);
  const text = raw
    .split("\n")
    .filter((l) => !/^(Loaded Prisma config|Prisma schema loaded|Datasource|Environment variables loaded)/.test(l.trim()))
    .join("\n")
    .trim();
  const failed = text.match(/The `([^`]+)` migration started at .* failed/)?.[1];
  if (/P3009/.test(text) && failed) {
    return `${text}\n\nA database update stopped half-way earlier. Make a copy of dev.db, then run in backend/:\n  npx prisma migrate resolve --rolled-back ${failed}\n  npm run db:sync\n(If it fails again, send the message above.)`;
  }
  return text;
}

/**
 * syncDatabase once per schema + migration set + database (cheap to call repeatedly).
 * Never throws: a failure is logged and kept for `lastSyncError()` (shown in the agent app).
 */
export function ensureDatabase(reason, log = console.log) {
  let key;
  try {
    key = `${schemaHash()}|${migrationNames().join(",")}|${process.env.DATABASE_URL ?? ""}`;
  } catch {
    return;
  }
  if (memo.__eliteDbSyncKey === key) return;
  try {
    syncDatabase({ log: (m) => log(`${m} (${reason})`) });
    memo.__eliteDbSyncKey = key;
    memo.__eliteDbSyncError = null;
  } catch (error) {
    const message = explain(error);
    memo.__eliteDbSyncError = message;
    console.error(`[db] Could not update the database (${reason}). Run \`npm run db:sync\` in backend/ to see why.\n${message}`);
  }
}

/** The last database update failure in this process, if any (development). */
export function lastSyncError() {
  return memo.__eliteDbSyncError ?? null;
}

// CLI
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    syncDatabase({ migrate: !process.argv.includes("--no-migrate") });
  } catch (error) {
    console.error(explain(error));
    process.exit(1);
  }
}
