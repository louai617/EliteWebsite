/**
 * Copies the SQLite database to ./backups/<name>-<timestamp>.db before risky operations
 * (migrations, imports). Uses SQLite's online backup API, so it is safe while the app runs.
 *
 *   npm run db:backup
 */
import "dotenv/config";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
if (!url.startsWith("file:")) {
  console.error("db:backup only supports SQLite (file:) databases. Use your database's own backup tooling.");
  process.exit(1);
}
const file = path.resolve(url.slice("file:".length));
if (!existsSync(file)) {
  console.log(`No database at ${file} — nothing to back up.`);
  process.exit(0);
}
const dir = path.resolve("backups");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(dir, `${path.basename(file, ".db")}-${stamp}.db`);
const db = new Database(file, { readonly: true });
await db.backup(target);
db.close();
console.log(`Backed up ${file} → ${target}`);
