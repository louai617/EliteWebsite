/**
 * Removes the demo data for a fresh start: every listing, owner, lead, client, viewing, deal,
 * task, report, document, reservation and log entry, and every account except the admins.
 * Company settings, scoring weights, contract templates and the company-wide daily tasks stay.
 *
 *   npm run db:clear-demo            shows what would be removed (changes nothing)
 *   npm run db:clear-demo -- --yes   backs up the database, then removes it
 *
 * The database is copied to ./backups first and the removed photos / files are moved to
 * ./backups/demo-files-<time>/, so nothing is lost for good. Delete that folder when sure.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { db } from "@/lib/db";
import { clearDemoData, demoDataCounts } from "@/services/demo-data";
import { refreshWebsiteNow } from "@/services/website-sync";

async function main() {
  console.log(`Database: ${process.env.DATABASE_URL ?? "file:./dev.db"}`);
  const counts = await demoDataCounts();
  console.table(counts);
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { name: true, email: true } });
  console.log(`Kept: ${admins.map((a) => `${a.email} (${a.name})`).join(", ") || "no admin account!"}, company settings, scoring, contract templates, daily task rules.`);
  if (!admins.length) {
    console.error("There is no admin account in this database — refusing to clear it (nobody could sign in afterwards).");
    process.exitCode = 1;
    return;
  }
  if (!process.argv.includes("--yes")) {
    console.log("\nNothing was changed. To remove all of the above, run:  npm run db:clear-demo -- --yes");
    return;
  }

  execFileSync(process.execPath, [path.join("scripts", "backup-db.mjs")], { stdio: "inherit" });
  const filesTo = path.resolve("backups", `demo-files-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const result = await clearDemoData({ moveFilesTo: filesTo });
  await refreshWebsiteNow();
  console.log(`\nDone. Removed ${result.removed.properties} listing(s), ${result.removed.managers} manager(s), ${result.removed.agents} agent(s) and everything linked to them.`);
  if (result.files) console.log(`${result.files} file(s) moved to ${filesTo}`);
  console.log("The next listing will be ELT-1001. Add your team in Users (Management).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
