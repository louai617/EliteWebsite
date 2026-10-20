/**
 * Keeps the local database code in step with prisma/schema.prisma, so pulling new code never
 * leaves the app on an old Prisma client ("Unknown field … for select statement") or an old
 * database ("The column … does not exist"):
 *
 *   1. regenerates the Prisma client (src/generated/prisma, not in git) when the schema or the
 *      Prisma version changed since it was last generated;
 *   2. applies pending migrations (`prisma migrate deploy`; never resets or deletes data).
 *
 * Runs before `npm run dev` and, in development, again when the server starts and whenever
 * prisma/schema.prisma or prisma/migrations change while it is running (src/instrumentation.ts).
 *
 *   node scripts/db-sync.mjs               generate if needed + apply migrations
 *   node scripts/db-sync.mjs --no-migrate  generate if needed only
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// CLI
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    syncDatabase({ migrate: !process.argv.includes("--no-migrate") });
  } catch (error) {
    console.error(String(error?.stderr || error?.stdout || error?.message || error));
    process.exit(1);
  }
}
