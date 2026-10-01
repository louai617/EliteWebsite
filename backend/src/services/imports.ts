import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { ExternalSource, ImportRecordStatus, ImportRunStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { hasPermission, type Actor } from "@/lib/permissions";
import { paginate, skipTake } from "@/lib/list-params";
import { adapterFor, ListingError, normalizedListingSchema, type NormalizedListing } from "@/integrations";
import { amenityFlags } from "@/integrations/mapping";
import { logActivity } from "./activity";
import { assertActiveUser } from "./access";
import { nextReference } from "./references";
import type { Tx } from "./types";

/**
 * Listing imports (Property Finder, Qatar Living, …).
 *
 *   raw record → adapter.normalize → schema validation → de-duplicate → create / update
 *
 * - Every run is an ImportRun; every record gets an ImportRecord (created/updated/unchanged/
 *   skipped/failed + message), so successes and failures are always traceable.
 * - Each record is written in its own transaction: one bad record never stops the batch.
 * - De-duplication: (source, externalId) via ExternalListing; then the listing URL already
 *   stored on a property. Unchanged records (same checksum) are skipped cheaply.
 * - Re-imports update portal-owned fields (title, price, specs, location, status…) but never
 *   reassign the agent, change the owner or delete anything.
 * - Dry runs do everything except write properties, so you can preview a file first.
 */

export const MAX_IMPORT_RECORDS = Number(process.env.IMPORT_MAX_RECORDS) || 2000;
const MAX_IMAGES = 20;

export interface ImportOptions {
  dryRun?: boolean;
  /** Agent for listings whose agent e-mail doesn't match a CRM user. */
  defaultAgentId?: string | null;
  trigger: "upload" | "api" | "remote";
}

function assertCanImport(actor: Actor) {
  if (!hasPermission(actor, "imports.run")) throw forbidden("Only managers and admins can import listings.");
}

const checksum = (listing: NormalizedListing) => createHash("sha256").update(JSON.stringify(listing)).digest("hex");

function truncate(value: unknown, max = 20_000) {
  try {
    const s = JSON.stringify(value);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return null;
  }
}

/** Readable reason for a failed record (never a stack trace or SQL). */
function failureMessage(error: unknown): string {
  if (error instanceof ListingError) return error.message;
  if (error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues: unknown[] }).issues)) {
    const issues = (error as { issues: { path: PropertyKey[]; message: string }[] }).issues;
    return issues.slice(0, 4).map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
  }
  console.error("[imports] unexpected record error", error);
  return "Unexpected error while saving this record.";
}

/** Property columns owned by the portal (safe to overwrite on re-import). */
function propertyFields(l: NormalizedListing) {
  return {
    title: l.title,
    description: l.description,
    type: l.propertyType,
    category: l.category,
    subcategory: l.subcategory,
    purpose: l.purpose,
    status: l.status,
    price: l.price,
    currency: l.currency,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    areaSqm: l.areaSqm,
    floor: l.floor,
    city: l.city,
    area: l.location,
    street: l.address,
    buildingName: l.building,
    furnishing: l.furnishing,
    latitude: l.latitude,
    longitude: l.longitude,
    parkingSpaces: typeof l.metadata.parking === "number" ? Math.max(0, Math.min(50, l.metadata.parking)) : undefined,
    ...amenityFlags(l.amenities),
    ...(l.source === "PROPERTY_FINDER" ? { propertyFinderUrl: l.sourceUrl } : { externalUrl: l.sourceUrl }),
  } satisfies Prisma.PropertyUncheckedUpdateInput;
}

/** Owner from the listing contact (private listings): reuse by phone/e-mail, else create. */
async function resolveOwner(tx: Tx, l: NormalizedListing, actorId: string) {
  const c = l.subcategory === "PRIVATE" ? l.contact : null;
  if (!c?.phone || !c.name) return null;
  const existing = await tx.owner.findFirst({ where: { OR: [{ phone: c.phone }, ...(c.email ? [{ email: c.email }] : [])] }, select: { id: true } });
  if (existing) return existing.id;
  const owner = await tx.owner.create({ data: { fullName: c.name, phone: c.phone, email: c.email, notes: `Imported from ${l.source === "PROPERTY_FINDER" ? "Property Finder" : "Qatar Living"}`, createdById: actorId }, select: { id: true } });
  return owner.id;
}

/** Listing agent by e-mail (active staff only), else the run's default agent. */
async function resolveAgent(l: NormalizedListing, defaultAgentId: string | null) {
  const email = l.agent?.email;
  if (email) {
    const user = await db.user.findFirst({ where: { email, isActive: true, role: { in: ["AGENT", "MANAGER", "ADMIN"] } }, select: { id: true } });
    if (user) return user.id;
  }
  return defaultAgentId;
}

type Outcome = { status: ImportRecordStatus; message: string; propertyId: string | null };

async function importOne(actor: Actor, runId: string, listing: NormalizedListing, raw: unknown, options: Required<Pick<ImportOptions, "dryRun">> & { defaultAgentId: string | null }): Promise<Outcome> {
  const sum = checksum(listing);
  const link = await db.externalListing.findUnique({ where: { source_externalId: { source: listing.source, externalId: listing.externalId } }, select: { id: true, checksum: true, propertyId: true } });

  // 1) Known listing, nothing changed.
  if (link && link.checksum === sum && link.propertyId) {
    if (!options.dryRun) await db.externalListing.update({ where: { id: link.id }, data: { lastImportedAt: new Date(), lastRunId: runId } });
    return { status: "UNCHANGED", message: "No changes since the last import", propertyId: link.propertyId };
  }

  // 2) Fallback match: a property that already carries this listing's URL.
  let propertyId = link?.propertyId ?? null;
  let matchedBy = propertyId ? "listing ID" : null;
  if (!propertyId && listing.sourceUrl) {
    const byUrl = await db.property.findFirst({ where: { OR: [{ propertyFinderUrl: listing.sourceUrl }, { externalUrl: listing.sourceUrl }] }, select: { id: true } });
    if (byUrl) {
      propertyId = byUrl.id;
      matchedBy = "listing URL";
    }
  }

  if (options.dryRun) {
    return propertyId ? { status: "UPDATED", message: `Would update the existing property (matched by ${matchedBy})`, propertyId } : { status: "CREATED", message: "Would create a new property", propertyId: null };
  }

  const agentId = propertyId ? null : await resolveAgent(listing, options.defaultAgentId);
  const sourceLabel = listing.source === "PROPERTY_FINDER" ? "Property Finder" : "Qatar Living";
  return db.$transaction(async (tx) => {
    let status: ImportRecordStatus;
    let id: string;
    if (propertyId) {
      const p = await tx.property.update({ where: { id: propertyId }, data: propertyFields(listing), select: { id: true, reference: true, title: true, ownerId: true } });
      id = p.id;
      status = "UPDATED";
      await logActivity(tx, {
        action: "UPDATED", entityType: "PROPERTY", entityId: p.id, entityLabel: `${p.reference} · ${p.title}`,
        description: `Updated ${p.reference} from ${sourceLabel}`, userId: actor.id, propertyId: p.id, ownerId: p.ownerId,
      });
    } else {
      const reference = await nextReference(tx, "property", "ELT");
      const ownerId = await resolveOwner(tx, listing, actor.id);
      const p = await tx.property.create({
        data: {
          ...propertyFields(listing),
          reference,
          agentId,
          ownerId,
          images: { create: listing.images.slice(0, MAX_IMAGES).map((url, i) => ({ url, sortOrder: i, isPrimary: i === 0 })) },
        },
        select: { id: true, reference: true, title: true, ownerId: true },
      });
      id = p.id;
      status = "CREATED";
      await logActivity(tx, {
        action: "CREATED", entityType: "PROPERTY", entityId: p.id, entityLabel: `${p.reference} · ${p.title}`,
        description: `Imported ${p.reference} from ${sourceLabel}`, userId: actor.id, propertyId: p.id, ownerId: p.ownerId,
      });
    }
    const data = { propertyId: id, sourceUrl: listing.sourceUrl, checksum: sum, normalized: JSON.stringify(listing), rawPayload: truncate(raw), lastImportedAt: new Date(), lastRunId: runId };
    await tx.externalListing.upsert({
      where: { source_externalId: { source: listing.source, externalId: listing.externalId } },
      create: { source: listing.source, externalId: listing.externalId, ...data },
      update: data,
    });
    const agentNote = status === "CREATED" ? (agentId ? "" : " · no matching agent, left unassigned") : "";
    return { status, message: status === "CREATED" ? `Created${agentNote}` : `Updated (matched by ${matchedBy})`, propertyId: id };
  });
}

/**
 * Runs an import. `records` comes from an upload/API body; without it, the adapter's remote
 * feed is fetched. Returns the finished run with counts.
 */
export async function runImport(actor: Actor, source: ExternalSource, records: unknown[] | null, options: ImportOptions) {
  assertCanImport(actor);
  const adapter = adapterFor(source);
  const defaultAgentId = options.defaultAgentId ?? null;
  if (defaultAgentId) await assertActiveUser(defaultAgentId);
  if (records && records.length > MAX_IMPORT_RECORDS) throw invalid(`Too many records (${records.length}). Import at most ${MAX_IMPORT_RECORDS} per batch.`);

  const run = await db.importRun.create({ data: { source, trigger: options.trigger, dryRun: Boolean(options.dryRun), startedById: actor.id }, select: { id: true } });
  const counts = { total: 0, created: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0 };

  let items: unknown[];
  try {
    items = records ?? (await adapter.fetchRemote());
    if (items.length > MAX_IMPORT_RECORDS) throw new ListingError(`The feed has ${items.length} records; the limit per run is ${MAX_IMPORT_RECORDS} (IMPORT_MAX_RECORDS).`);
  } catch (error) {
    const message = error instanceof ListingError ? error.message : "Couldn't load the listings.";
    if (!(error instanceof ListingError)) console.error("[imports] fetch failed", error);
    await db.importRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    return getImportRun(actor, run.id);
  }

  const seen = new Set<string>();
  const log: Prisma.ImportRecordCreateManyInput[] = [];
  for (const [index, raw] of items.entries()) {
    counts.total++;
    const externalId = adapter.externalIdOf(raw);
    let outcome: Outcome;
    try {
      if (externalId && seen.has(externalId)) {
        outcome = { status: "SKIPPED", message: "Duplicate of an earlier record in this batch", propertyId: null };
      } else {
        if (externalId) seen.add(externalId);
        const listing = normalizedListingSchema.parse(adapter.normalize(raw));
        outcome = await importOne(actor, run.id, listing, raw, { dryRun: Boolean(options.dryRun), defaultAgentId });
      }
    } catch (error) {
      outcome = { status: "FAILED", message: failureMessage(error), propertyId: null };
    }
    counts[outcome.status.toLowerCase() as "created" | "updated" | "unchanged" | "skipped" | "failed"]++;
    log.push({ runId: run.id, position: index + 1, externalId, status: outcome.status, message: outcome.message.slice(0, 500), propertyId: outcome.propertyId });
    if (log.length >= 200) await db.importRecord.createMany({ data: log.splice(0) });
  }
  if (log.length) await db.importRecord.createMany({ data: log });

  const status: ImportRunStatus = counts.total > 0 && counts.failed === counts.total ? "FAILED" : counts.failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  await db.importRun.update({
    where: { id: run.id },
    data: { ...counts, status, finishedAt: new Date(), error: counts.total === 0 ? "The payload contained no listings." : null },
  });
  return getImportRun(actor, run.id);
}

export const importRunSelect = {
  id: true,
  source: true,
  status: true,
  trigger: true,
  dryRun: true,
  total: true,
  created: true,
  updated: true,
  unchanged: true,
  skipped: true,
  failed: true,
  error: true,
  startedAt: true,
  finishedAt: true,
  startedBy: { select: { id: true, name: true } },
} satisfies Prisma.ImportRunSelect;

export type ImportRunItem = Prisma.ImportRunGetPayload<{ select: typeof importRunSelect }>;

export async function listImportRuns(actor: Actor, { source, page = 1, pageSize = 20 }: { source?: ExternalSource; page?: number; pageSize?: number }) {
  assertCanImport(actor);
  const where: Prisma.ImportRunWhereInput = source ? { source } : {};
  const [items, total] = await Promise.all([
    db.importRun.findMany({ where, orderBy: { startedAt: "desc" }, ...skipTake(page, pageSize), select: importRunSelect }),
    db.importRun.count({ where }),
  ]);
  return paginate(items, total, page, pageSize);
}

export async function getImportRun(actor: Actor, id: string, recordStatus?: ImportRecordStatus) {
  assertCanImport(actor);
  const run = await db.importRun.findUnique({
    where: { id },
    select: {
      ...importRunSelect,
      records: {
        where: recordStatus ? { status: recordStatus } : {},
        orderBy: { position: "asc" },
        take: 1000,
        select: { id: true, position: true, externalId: true, status: true, message: true, propertyId: true },
      },
    },
  });
  if (!run) throw notFound("Import run");
  return run;
}

export type ImportRunDetail = Awaited<ReturnType<typeof getImportRun>>;

/** Integration status for the UI/API: configuration (never secret values) and the latest runs. */
export async function integrationStatus(actor: Actor, source: ExternalSource) {
  assertCanImport(actor);
  const adapter = adapterFor(source);
  const [lastRun, linked] = await Promise.all([
    db.importRun.findFirst({ where: { source, dryRun: false }, orderBy: { startedAt: "desc" }, select: importRunSelect }),
    db.externalListing.count({ where: { source, propertyId: { not: null } } }),
  ]);
  return { source, label: adapter.label, ...adapter.status(), lastRun, linkedListings: linked, maxRecordsPerRun: MAX_IMPORT_RECORDS };
}
