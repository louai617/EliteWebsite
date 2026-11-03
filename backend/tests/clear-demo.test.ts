/**
 * Clearing the demo data (`npm run db:clear-demo`): everything but the admin accounts and the
 * company configuration goes, files are moved aside, and the empty CRM still works.
 * Runs last: it empties the throwaway ./test.db.
 */
import "dotenv/config";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { resolveRange } from "@/lib/business-day";
import { propertySchema } from "@/schemas/property";
import { createUserSchema } from "@/schemas/user";
import { runDailyRollover } from "@/services/daily";
import { dashboardStats } from "@/services/dashboard";
import { clearDemoData, demoDataCounts } from "@/services/demo-data";
import { performanceBoard } from "@/services/performance";
import { createProperty, uploadPropertyPhoto } from "@/services/properties";
import { getPublicListing, listPublicListings } from "@/services/public-listings";
import { createUser } from "@/services/users";
import type { Role } from "@/generated/prisma/enums";

let pass = 0;
let fail = 0;
function check(name: string, ok: unknown, extra?: unknown) {
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL  ${name}`, extra ?? "");
  }
}
const actorFor = async (email: string) => (await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true } })) as { id: string; role: Role };
const uploadsFile = (url: string) => path.join(process.cwd(), "storage", "uploads", url.replace(/^\/api\/uploads\//, ""));
const filesUnder = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name)) : []);

async function main() {
  const admin = await actorFor("admin@elite.qa");
  const omar = await actorFor("omar@elite.qa");
  const manager = await actorFor("fatima@elite.qa");
  const adminBefore = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
  const templatesBefore = await db.dailyTaskTemplate.count({ where: { assigneeId: null } });
  const contractTemplates = await db.contractTemplate.count();
  await db.settings.update({ where: { id: "default" }, data: { leadEscalationUserId: manager.id, companyName: "ELITE Real Estate", bankAccountName: "ELITE Real Estate W.L.L." } });

  // An uploaded photo, so files are part of the clear.
  const owner = await db.owner.findFirstOrThrow({ select: { id: true } });
  const p = await createProperty(omar, propertySchema.parse({ title: "Clear test flat", type: "APARTMENT", purpose: "RENT", status: "AVAILABLE", price: "9000", currency: "QAR", country: "Qatar", city: "Doha", area: "Pearl", bedrooms: "1", ownerId: owner.id, agentId: null, websitePublished: true }));
  const photo = await uploadPropertyPhoto(omar, p.id, new File([new Uint8Array(await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#456" } }).jpeg().toBuffer())], "a.jpg", { type: "image/jpeg" }));
  const master = (await db.propertyImage.findUniqueOrThrow({ where: { id: photo.id } })).masterKey!;

  const before = await demoDataCounts();
  check("the demo dataset is counted", before.properties > 20 && before.agents >= 5 && before.managers >= 2 && before.leads > 0 && before.deals > 0, before);

  const target = mkdtempSync(path.join(tmpdir(), "elite-clear-"));
  const result = await clearDemoData({ moveFilesTo: target });
  const after = await demoDataCounts();
  check("every listing, lead, client, deal, task and log entry is gone", Object.values(after).every((n) => n === 0), after);
  check("other tables are empty too", (await db.owner.count()) + (await db.agentActivity.count()) + (await db.dailyReport.count()) + (await db.note.count()) + (await db.emailLog.count()) + (await db.externalListing.count()) + (await db.propertyMedia.count()) === 0);
  const users = await db.user.findMany({ select: { email: true, role: true } });
  check("only the admin account is left", users.length === 1 && users[0].email === "admin@elite.qa" && users[0].role === "ADMIN", users);
  const adminAfter = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
  check("the admin keeps the same password and sessions", adminAfter.passwordHash === adminBefore.passwordHash && result.admins.length === 1);
  check("company-wide daily tasks and contract templates stay", (await db.dailyTaskTemplate.count()) === templatesBefore && (await db.contractTemplate.count()) === contractTemplates);
  const settings = await db.settings.findUniqueOrThrow({ where: { id: "default" } });
  check("settings stay, minus the demo bank details and the removed escalation contact", settings.companyName === "ELITE Real Estate" && settings.bankAccountName === "ELITE Real Estate W.L.L." && !settings.bankIban && !settings.fawranAlias && !settings.bankName && !settings.leadEscalationUserId, settings);
  check("the photo files were moved aside, not left behind", !existsSync(uploadsFile(photo.url)) && !existsSync(uploadsFile(photo.thumbUrl!)) && filesUnder(target).length === 3 && filesUnder(target).some((f) => f.endsWith(path.basename(master))), filesUnder(target));
  rmSync(target, { recursive: true, force: true });

  // The empty CRM still works.
  const stats = await dashboardStats(admin);
  check("the dashboard works with no data", Boolean(stats));
  const board = await performanceBoard(admin, resolveRange("week"));
  check("the leaderboard is empty", board.agents.length === 0);
  check("the website has no listings", (await listPublicListings({}, { page: 1, pageSize: 12, sort: "newest" }, "http://api.test")).total === 0 && (await getPublicListing(p.reference, "http://api.test")) === null);
  await db.systemJob.deleteMany({ where: { key: { startsWith: "daily-rollover:" } } });
  const rollover = await runDailyRollover();
  check("the daily rollover runs with no agents", !rollover.skipped, rollover);
  const first = await createProperty(admin, propertySchema.parse({ title: "First real listing", type: "VILLA", purpose: "SALE", status: "AVAILABLE", price: "3000000", currency: "QAR", country: "Qatar", city: "Doha", area: "West Bay", bedrooms: "4", ownerId: null, agentId: null, websitePublished: false }));
  check("reference numbers start again", first.reference === "ELT-1001", first.reference);
  const agent = await createUser(admin, createUserSchema.parse({ name: "New Agent", email: "new.agent@eliterealestate.qa", phone: "", role: "AGENT", avatarUrl: "", isActive: true, password: "Welcome@2026x" }));
  check("the admin can add the real team", (await db.user.findUniqueOrThrow({ where: { id: agent.id } })).role === "AGENT");

  console.log(`clear-demo tests: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
