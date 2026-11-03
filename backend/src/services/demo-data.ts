import "server-only";
import { copyFile, mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { PUBLIC_PREFIX } from "./storage";

/**
 * Empties the CRM for a fresh start (`npm run db:clear-demo`): every listing, owner, lead,
 * leads-pool entry, client, viewing, deal, task, report, document, reservation, import and log entry, and every
 * account except the admins. Company settings, scoring weights, contract templates and the
 * company-wide daily tasks stay; reference numbers start again (first listing ELT-1001).
 *
 * The files of the removed records (photos, originals, videos, floor plans, documents) are moved
 * to `moveFilesTo` when given (so nothing is lost for good), otherwise deleted.
 */

const STORAGE = path.join(/*turbopackIgnore: true*/ process.cwd(), "storage");

/** Placeholder payment details from the demo seed (cleared, so nobody is told to pay them). */
const DEMO_PAYMENT = {
  bankName: "Demo Bank (replace in Settings)",
  bankIban: "QA00DEMO000000000000000000000",
  fawranAlias: "ELITE-DEMO",
  paymentInstructions: "Demo details for local testing — do not transfer money.",
} as const;

/** How many records a clear would remove. */
export async function demoDataCounts() {
  const [properties, photos, owners, leads, poolLeads, clients, viewings, deals, tasks, documents, reservations, activityLog, accounts] = await Promise.all([
    db.property.count(),
    db.propertyImage.count(),
    db.owner.count(),
    db.lead.count(),
    db.poolLead.count(),
    db.client.count(),
    db.viewing.count(),
    db.deal.count(),
    db.task.count(),
    db.document.count(),
    db.reservation.count(),
    db.activity.count(),
    db.user.groupBy({ by: ["role"], where: { role: { not: "ADMIN" } }, _count: { _all: true } }),
  ]);
  const byRole = Object.fromEntries(accounts.map((a) => [a.role, a._count._all])) as Partial<Record<string, number>>;
  return {
    properties,
    photos,
    owners,
    leads,
    poolLeads,
    clients,
    viewings,
    deals,
    tasks,
    documents,
    reservations,
    activityLog,
    managers: byRole.MANAGER ?? 0,
    agents: byRole.AGENT ?? 0,
    clientLogins: byRole.CLIENT ?? 0,
  };
}

/** Absolute path of a stored file under ./storage/<area>, or null if it isn't one of ours. */
function storagePath(area: "uploads" | "photo-masters" | "media" | "documents", rel: string) {
  const root = path.join(STORAGE, area);
  const full = path.resolve(root, rel);
  return full.startsWith(root + path.sep) ? full : null;
}

async function relocate(file: string, moveFilesTo?: string) {
  if (!moveFilesTo) return unlink(/*turbopackIgnore: true*/ file).then(() => true, () => false);
  const target = path.join(moveFilesTo, path.relative(STORAGE, file));
  try {
    await mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
    await rename(/*turbopackIgnore: true*/ file, target).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EXDEV") throw error;
      await copyFile(/*turbopackIgnore: true*/ file, target);
      await unlink(/*turbopackIgnore: true*/ file);
    });
    return true;
  } catch {
    return false; // already gone
  }
}

export async function clearDemoData({ moveFilesTo }: { moveFilesTo?: string } = {}) {
  const before = await demoDataCounts();

  // Files to remove once the records are gone.
  const [images, media, documents] = await Promise.all([
    db.propertyImage.findMany({ select: { url: true, thumbUrl: true, masterKey: true } }),
    db.propertyMedia.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true } }),
    db.document.findMany({ select: { storageKey: true } }),
  ]);
  const files = [
    ...images.flatMap((i) => [i.url, i.thumbUrl].filter((u): u is string => Boolean(u?.startsWith(PUBLIC_PREFIX))).map((u) => storagePath("uploads", u.slice(PUBLIC_PREFIX.length)))),
    ...images.map((i) => (i.masterKey ? storagePath("photo-masters", i.masterKey) : null)),
    ...media.map((m) => storagePath("media", m.storageKey!)),
    ...documents.map((d) => storagePath("documents", d.storageKey)),
  ].filter((f): f is string => Boolean(f));

  await db.$transaction(async (tx) => {
    // Children first (foreign keys).
    await tx.contract.deleteMany();
    await tx.document.deleteMany();
    await tx.reservation.deleteMany();
    await tx.leadPassRequest.deleteMany();
    await tx.poolLead.deleteMany();
    await tx.otpCode.deleteMany();
    await tx.emailLog.deleteMany();
    await tx.importRecord.deleteMany();
    await tx.importRun.deleteMany();
    await tx.externalListing.deleteMany();
    await tx.agentActivity.deleteMany();
    await tx.dailyReport.deleteMany();
    await tx.taskEvent.deleteMany();
    await tx.activity.deleteMany();
    await tx.note.deleteMany();
    await tx.task.deleteMany();
    await tx.deal.deleteMany();
    await tx.viewing.deleteMany();
    await tx.propertyInterest.deleteMany();
    await tx.lead.deleteMany();
    await tx.client.deleteMany();
    await tx.propertyMedia.deleteMany();
    await tx.propertyImage.deleteMany();
    await tx.property.deleteMany();
    await tx.owner.deleteMany();
    // Their sessions, password codes and personal daily tasks go with them (cascade).
    await tx.agentPayout.deleteMany();
    await tx.user.deleteMany({ where: { role: { not: "ADMIN" } } });
    // ELT-1001, DL-1001… again.
    await tx.counter.deleteMany();

    const settings = await tx.settings.findUnique({ where: { id: "default" } });
    if (settings) {
      const escalationKept = settings.leadEscalationUserId ? await tx.user.count({ where: { id: settings.leadEscalationUserId } }) : 0;
      await tx.settings.update({
        where: { id: "default" },
        data: {
          ...(!escalationKept && { leadEscalationUserId: null }),
          ...Object.fromEntries((Object.keys(DEMO_PAYMENT) as (keyof typeof DEMO_PAYMENT)[]).filter((k) => settings[k] === DEMO_PAYMENT[k]).map((k) => [k, null])),
        },
      });
    }
  }, { timeout: 120_000 });

  let moved = 0;
  for (const file of files) if (await relocate(file, moveFilesTo)) moved++;

  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { name: true, email: true } });
  return { removed: before, files: moved, admins };
}
