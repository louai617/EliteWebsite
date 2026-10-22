import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Furnishing, ListingPurpose, PropertyCategory, PropertyStatus, PropertySubcategory, PropertyType } from "@/generated/prisma/enums";
import sharp from "sharp";
import { db } from "@/lib/db";
import { businessDate } from "@/lib/business-day";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { can, canAssignTo, canEditProperty, canSeeOwnerContact, isManager, isStaff, scope, type Actor } from "@/lib/permissions";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { PROPERTY_HIERARCHY, PROPERTY_STATUS_META, categoryForType } from "@/lib/constants";
import { like } from "@/lib/search";
import type { propertySchema, updatePropertySchema } from "@/schemas/property";
import { logActivity } from "./activity";
import { onPropertyCreated } from "./automation";
import { assertActiveUser, assertCanAccess } from "./access";
import { nextReference } from "./references";
import { PHOTO_RULES, processPhoto, readMaster, removePhotoFiles, storePhoto, type StoredPhoto } from "./photos";
import { deleteMediaFile } from "./storage";
import { notifyWebsite } from "./website-sync";
import { recordWorkActivity } from "./work-activities";
import type { Tx } from "./types";

export const PROPERTY_SORTS = ["createdAt", "updatedAt", "price", "areaSqm", "bedrooms", "reference", "title"] as const;

export interface PropertyFilters {
  category?: PropertyCategory;
  subcategory?: PropertySubcategory;
  status?: PropertyStatus;
  purpose?: ListingPurpose;
  type?: PropertyType;
  area?: string;
  priceMin?: number;
  priceMax?: number;
  beds?: number;
  furnishing?: Furnishing;
  agentId?: string;
  ownerId?: string;
  featured?: boolean;
  /** live = shown on the website now; hidden = not shown (unpublished or not available). */
  website?: "live" | "hidden";
}

export function propertyWhere(actor: Actor, q: string | undefined, f: PropertyFilters): Prisma.PropertyWhereInput {
  return {
    AND: [
      scope.properties(actor),
      q
        ? {
            OR: [
              { reference: like(q) },
              { title: like(q) },
              { area: like(q) },
              { buildingName: like(q) },
              { tower: like(q) },
              { street: like(q) },
            ],
          }
        : {},
      f.category ? { category: f.category } : {},
      f.subcategory ? { subcategory: f.subcategory } : {},
      f.status ? { status: f.status } : {},
      f.purpose ? { purpose: f.purpose } : {},
      f.type ? { type: f.type } : {},
      f.area ? { area: f.area } : {},
      f.priceMin !== undefined || f.priceMax !== undefined ? { price: { gte: f.priceMin, lte: f.priceMax } } : {},
      // "3" means 3+ bedrooms; 0 means studio exactly.
      f.beds !== undefined ? (f.beds === 0 ? { bedrooms: 0 } : { bedrooms: { gte: f.beds } }) : {},
      f.furnishing ? { furnishing: f.furnishing } : {},
      f.agentId ? (f.agentId === "none" ? { agentId: null } : { agentId: f.agentId }) : {},
      f.ownerId ? { ownerId: f.ownerId } : {},
      f.featured ? { isFeatured: true } : {},
      f.website === "live" ? { websitePublished: true, status: { in: ["AVAILABLE", "RESERVED"] } } : {},
      f.website === "hidden" ? { OR: [{ websitePublished: false }, { status: { notIn: ["AVAILABLE", "RESERVED"] } }] } : {},
    ],
  };
}

const listSelect = {
  id: true,
  reference: true,
  websitePublished: true,
  title: true,
  type: true,
  category: true,
  subcategory: true,
  purpose: true,
  status: true,
  price: true,
  currency: true,
  area: true,
  buildingName: true,
  bedrooms: true,
  bathrooms: true,
  areaSqm: true,
  furnishing: true,
  isFeatured: true,
  createdAt: true,
  updatedAt: true,
  agentId: true,
  agent: { select: { id: true, name: true, avatarUrl: true } },
  owner: { select: { id: true, fullName: true } },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, thumbUrl: true } },
  _count: { select: { viewings: true, interests: true } },
} satisfies Prisma.PropertySelect;

export async function listProperties(actor: Actor, params: ListParams<(typeof PROPERTY_SORTS)[number]>, filters: PropertyFilters) {
  const where = propertyWhere(actor, params.q, filters);
  const [rows, total] = await Promise.all([
    db.property.findMany({ where, orderBy: [{ [params.sort]: params.dir }, { id: "asc" }], ...skipTake(params.page, params.pageSize), select: listSelect }),
    db.property.count({ where }),
  ]);
  // Agents see which owner a listing belongs to only for their own listings.
  const items = rows.map(({ images, ...row }) => ({
    ...row,
    imageUrl: images[0]?.thumbUrl ?? images[0]?.url ?? null,
    owner: canSeeOwnerContact(actor, row) ? row.owner : null,
  }));
  return paginate(items, total, params.page, params.pageSize);
}

export type PropertyListItem = Awaited<ReturnType<typeof listProperties>>["items"][number];

/**
 * The property hierarchy with live counts:
 * [{ category, label, count, subcategories: [{ subcategory, label, count }] }].
 */
export async function propertyHierarchy(actor: Actor) {
  const rows = await db.property.groupBy({ by: ["category", "subcategory"], where: scope.properties(actor), _count: { _all: true } });
  const count = (category: PropertyCategory, subcategory?: PropertySubcategory) =>
    rows.filter((r) => r.category === category && (!subcategory || r.subcategory === subcategory)).reduce((sum, r) => sum + r._count._all, 0);
  return PROPERTY_HIERARCHY.map((node) => ({
    category: node.category,
    label: node.label,
    count: count(node.category),
    subcategories: node.subcategories.map((sub) => ({ ...sub, count: count(node.category, sub.subcategory) })),
  }));
}

/** Distinct areas in use (for filter dropdowns), merged with the Doha suggestions. */
export async function propertyAreas() {
  const rows = await db.property.findMany({ distinct: ["area"], select: { area: true }, orderBy: { area: "asc" } });
  return rows.map((r) => r.area);
}

export async function getProperty(actor: Actor, id: string) {
  const property = await db.property.findFirst({
    where: { id, ...scope.properties(actor) },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      owner: true,
      agent: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      interests: {
        orderBy: { createdAt: "desc" },
        where: isManager(actor) ? {} : { OR: [{ lead: { agentId: actor.id } }, { client: { agentId: actor.id } }] },
        select: {
          id: true,
          createdAt: true,
          lead: { select: { id: true, fullName: true, phone: true, status: true, priority: true, agent: { select: { name: true } } } },
          client: { select: { id: true, fullName: true, phone: true, clientType: true } },
        },
      },
      viewings: {
        where: { ...scope.viewings(actor) },
        orderBy: { startsAt: "desc" },
        take: 20,
        select: {
          id: true, startsAt: true, endsAt: true, status: true,
          lead: { select: { id: true, fullName: true } },
          client: { select: { id: true, fullName: true } },
          agent: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      deals: {
        where: { ...scope.deals(actor) },
        orderBy: { createdAt: "desc" },
        select: { id: true, reference: true, type: true, status: true, amount: true, commissionAmount: true, createdAt: true, closedAt: true, client: { select: { id: true, fullName: true } }, lead: { select: { id: true, fullName: true } } },
      },
    },
  });
  if (!property) return null;
  const showOwner = canSeeOwnerContact(actor, property);
  return {
    ...property,
    // The private original's storage key stays on the server; the UI only needs to know there is one.
    images: property.images.map(({ masterKey, watermarkVersion: _version, ...image }) => ({ ...image, hasOriginal: Boolean(masterKey) })),
    owner: showOwner ? property.owner : null,
    ownerHidden: !showOwner && Boolean(property.ownerId),
    canEdit: canEditProperty(actor, property),
    canDelete: can.deleteRecords(actor),
  };
}

export type PropertyDetail = NonNullable<Awaited<ReturnType<typeof getProperty>>>;

/** Data for the edit form (full record, permission-checked). */
export async function getPropertyForEdit(actor: Actor, id: string) {
  const property = await db.property.findUnique({ where: { id }, include: { owner: { select: { id: true, fullName: true, phone: true } } } });
  if (!property) return null;
  if (!canEditProperty(actor, property)) throw forbidden("You can only edit listings assigned to you.");
  return property;
}

async function checkRelations(actor: Actor, input: { ownerId: string | null; agentId: string | null }) {
  if (!canAssignTo(actor, input.agentId)) throw forbidden("You can only assign listings to yourself.");
  await assertActiveUser(input.agentId);
  if (input.ownerId) await assertCanAccess(actor, "owner", input.ownerId);
}

/** Website lists are stored as JSON text; empty lists as NULL. */
function toDbFields<T extends { amenities: string[]; highlights: string[]; nearby: unknown[]; paymentPlan: unknown[] }>(input: T) {
  const json = (list: unknown[]) => (list.length ? JSON.stringify(list) : null);
  return { ...input, amenities: json(input.amenities), highlights: json(input.highlights), nearby: json(input.nearby), paymentPlan: json(input.paymentPlan) };
}

/** Publishing a listing on the website counts as posting it (once per listing per day). */
async function recordWebsitePosting(tx: Tx, property: { id: string; agentId: string | null }, actor: Actor) {
  const agentId = property.agentId ?? (isStaff(actor) ? actor.id : null);
  if (!agentId) return;
  const today = businessDate();
  await recordWorkActivity(tx, {
    type: "PROPERTY_POST", agentId, source: "SYSTEM", loggedById: actor.id, propertyId: property.id,
    outcome: "Website", dedupeKey: `website-post:${property.id}:${today}`,
  });
}

export async function createProperty(actor: Actor, input: z.output<typeof propertySchema>) {
  const data = {
    ...toDbFields(input),
    category: input.category ?? categoryForType(input.type),
    agentId: input.agentId ?? (isManager(actor) ? null : actor.id),
    websitePublishedAt: input.websitePublished ? new Date() : null,
  };
  await checkRelations(actor, data);
  return db.$transaction(async (tx) => {
    const reference = await nextReference(tx, "property", "ELT");
    const property = await tx.property.create({ data: { ...data, reference }, select: { id: true, reference: true, title: true, agentId: true, ownerId: true } });
    await onPropertyCreated(tx, property, { id: actor.id, staff: isStaff(actor) });
    if (data.websitePublished) await recordWebsitePosting(tx, property, actor);
    const label = `${property.reference} · ${property.title}`;
    await logActivity(tx, {
      action: "CREATED", entityType: "PROPERTY", entityId: property.id, entityLabel: label,
      description: `Listed ${label}`, userId: actor.id, propertyId: property.id, ownerId: property.ownerId,
    });
    if (property.agentId && property.agentId !== actor.id) {
      const agent = await tx.user.findUnique({ where: { id: property.agentId }, select: { name: true } });
      await logActivity(tx, {
        action: "ASSIGNED", entityType: "PROPERTY", entityId: property.id, entityLabel: label,
        description: `Assigned ${property.reference} to ${agent?.name ?? "an agent"}`, userId: actor.id, propertyId: property.id,
      });
    }
    return property;
  }).finally(notifyWebsite);
}

export async function updateProperty(actor: Actor, input: z.output<typeof updatePropertySchema>) {
  const { id, ...fields } = input;
  const current = await db.property.findUnique({ where: { id }, select: { id: true, reference: true, agentId: true, status: true, websitePublished: true } });
  const publishing = Boolean(fields.websitePublished && !current?.websitePublished);
  const data = {
    ...toDbFields(fields),
    category: fields.category ?? categoryForType(fields.type),
    ...(publishing ? { websitePublishedAt: new Date() } : {}),
  };
  if (!current) throw notFound("Property");
  if (!canEditProperty(actor, current)) throw forbidden("You can only edit listings assigned to you.");
  if (!isManager(actor) && data.agentId !== current.agentId) throw forbidden("Only managers can reassign listings.");
  await checkRelations(actor, data);

  return db.$transaction(async (tx) => {
    const property = await tx.property.update({ where: { id }, data, select: { id: true, reference: true, title: true, agentId: true, ownerId: true, status: true } });
    const label = `${property.reference} · ${property.title}`;
    const links = { propertyId: id, ownerId: property.ownerId };
    if (publishing) await recordWebsitePosting(tx, property, actor);
    if (current.websitePublished !== data.websitePublished) {
      await logActivity(tx, {
        action: "UPDATED", entityType: "PROPERTY", entityId: id, entityLabel: label, userId: actor.id, ...links,
        description: data.websitePublished ? `Published ${property.reference} on the website` : `Removed ${property.reference} from the website`,
      });
    }
    if (current.status !== property.status) {
      await logActivity(tx, {
        action: "STATUS_CHANGED", entityType: "PROPERTY", entityId: id, entityLabel: label, userId: actor.id, ...links,
        description: `Changed ${property.reference} from ${PROPERTY_STATUS_META[current.status].label} to ${PROPERTY_STATUS_META[property.status].label}`,
        meta: { from: current.status, to: property.status },
      });
    }
    if (current.agentId !== property.agentId) {
      const agent = property.agentId ? await tx.user.findUnique({ where: { id: property.agentId }, select: { name: true } }) : null;
      await logActivity(tx, {
        action: "ASSIGNED", entityType: "PROPERTY", entityId: id, entityLabel: label, userId: actor.id, ...links,
        description: agent ? `Assigned ${property.reference} to ${agent.name}` : `Unassigned ${property.reference}`,
      });
    }
    await logActivity(tx, { action: "UPDATED", entityType: "PROPERTY", entityId: id, entityLabel: label, description: `Updated ${label}`, userId: actor.id, ...links });
    return property;
  }).finally(notifyWebsite);
}

export async function setPropertyStatus(actor: Actor, id: string, status: PropertyStatus) {
  const current = await db.property.findUnique({ where: { id }, select: { id: true, reference: true, title: true, agentId: true, ownerId: true, status: true } });
  if (!current) throw notFound("Property");
  if (!canEditProperty(actor, current)) throw forbidden("You can only change the status of your own listings.");
  if (current.status === status) return current;
  return db.$transaction(async (tx) => {
    const property = await tx.property.update({ where: { id }, data: { status }, select: { id: true, reference: true, title: true, status: true } });
    await logActivity(tx, {
      action: "STATUS_CHANGED", entityType: "PROPERTY", entityId: id, entityLabel: `${current.reference} · ${current.title}`,
      description: `Changed ${current.reference} from ${PROPERTY_STATUS_META[current.status].label} to ${PROPERTY_STATUS_META[status].label}`,
      userId: actor.id, propertyId: id, ownerId: current.ownerId, meta: { from: current.status, to: status },
    });
    return property;
  }).finally(notifyWebsite);
}

export async function deleteProperty(actor: Actor, id: string) {
  if (!can.deleteRecords(actor)) throw forbidden("Only managers can delete properties.");
  const property = await db.property.findUnique({
    where: { id },
    select: { reference: true, title: true, images: { select: { url: true, thumbUrl: true, masterKey: true } }, media: { select: { storageKey: true } }, _count: { select: { deals: true } } },
  });
  if (!property) throw notFound("Property");
  if (property._count.deals > 0) {
    throw conflict(`${property.reference} has ${property._count.deals} deal(s) on record and can't be deleted. Mark it Off market instead.`);
  }
  await db.$transaction(async (tx) => {
    await tx.property.delete({ where: { id } });
    await logActivity(tx, {
      action: "DELETED", entityType: "PROPERTY", entityId: id, entityLabel: `${property.reference} · ${property.title}`,
      description: `Deleted ${property.reference} — ${property.title}`, userId: actor.id,
    });
  });
  await Promise.all(property.images.map(removePhotoFiles));
  await Promise.all(property.media.map((m) => (m.storageKey ? deleteMediaFile(m.storageKey) : undefined)));
  notifyWebsite();
}

// ─── Images ───

export async function editableProperty(actor: Actor, propertyId: string) {
  const property = await db.property.findUnique({ where: { id: propertyId }, select: { id: true, agentId: true, reference: true, title: true } });
  if (!property) throw notFound("Property");
  if (!canEditProperty(actor, property)) throw forbidden("You can only manage photos and media of your own listings.");
  return property;
}

type PhotoMeta = Omit<StoredPhoto, "url" | "lowRes">;

export async function addPropertyImage(actor: Actor, propertyId: string, url: string, meta?: PhotoMeta) {
  const property = await editableProperty(actor, propertyId);
  return db.$transaction(async (tx) => {
    const count = await tx.propertyImage.count({ where: { propertyId } });
    if (count >= PHOTO_RULES.maxPhotos) throw invalid(`A listing can have at most ${PHOTO_RULES.maxPhotos} photos.`);
    const last = await tx.propertyImage.findFirst({ where: { propertyId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const hasCover = await tx.propertyImage.count({ where: { propertyId, isPrimary: true } });
    const image = await tx.propertyImage.create({
      data: { propertyId, url, ...meta, sortOrder: (last?.sortOrder ?? -1) + 1, isPrimary: hasCover === 0 },
      select: { id: true, url: true, thumbUrl: true, width: true, height: true, bytes: true, isPrimary: true, sortOrder: true },
    });
    await logActivity(tx, {
      action: "IMAGE_ADDED", entityType: "PROPERTY", entityId: propertyId, entityLabel: `${property.reference} · ${property.title}`,
      description: `Added a photo to ${property.reference}`, userId: actor.id, propertyId,
    });
    return image;
  }).finally(notifyWebsite);
}

/**
 * Uploads one photo: checks access and the 40-photo limit before any work, then optimizes it
 * (services/photos.ts), refuses an exact duplicate on the same listing and records it.
 */
export async function uploadPropertyPhoto(actor: Actor, propertyId: string, file: File) {
  await editableProperty(actor, propertyId);
  if ((await db.propertyImage.count({ where: { propertyId } })) >= PHOTO_RULES.maxPhotos) {
    throw invalid(`A listing can have at most ${PHOTO_RULES.maxPhotos} photos.`);
  }
  if (file.size > PHOTO_RULES.maxBytes) throw invalid("Photos must be 10 MB or smaller.", { file: ["Max 10 MB"] });
  const photo = await processPhoto(Buffer.from(await file.arrayBuffer()));
  if (await db.propertyImage.findFirst({ where: { propertyId, checksum: photo.checksum }, select: { id: true } })) {
    throw conflict("This photo is already in the listing.");
  }
  const { lowRes, ...stored } = await storePhoto(propertyId, photo);
  try {
    const image = await addPropertyImage(actor, propertyId, stored.url, stored);
    return { ...image, lowRes, hasOriginal: true };
  } catch (error) {
    await removePhotoFiles(stored);
    throw error;
  }
}

export async function removePropertyImage(actor: Actor, imageId: string) {
  const image = await db.propertyImage.findUnique({ where: { id: imageId }, select: { id: true, propertyId: true, isPrimary: true, url: true, thumbUrl: true, masterKey: true } });
  if (!image) throw notFound("Photo");
  await editableProperty(actor, image.propertyId);
  await db.$transaction(async (tx) => {
    await tx.propertyImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
      const next = await tx.propertyImage.findFirst({ where: { propertyId: image.propertyId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
      if (next) await tx.propertyImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });
  await removePhotoFiles(image);
  notifyWebsite();
}

/**
 * The clean original of a listing photo (no watermark) as a JPEG, e.g. to upload to a portal.
 * Only staff who can edit the listing (its agent, managers, admins). Null when there is none
 * (photos pasted as links, or not processed yet).
 */
export async function openPhotoOriginal(actor: Actor, propertyId: string, imageId: string) {
  const image = await db.propertyImage.findFirst({
    where: { id: imageId, propertyId },
    select: { masterKey: true, sortOrder: true, property: { select: { reference: true, agentId: true } } },
  });
  if (!image) return null;
  if (!isStaff(actor) || !canEditProperty(actor, image.property)) throw forbidden("Only the listing's agent and managers can download original photos.");
  const master = image.masterKey ? await readMaster(image.masterKey) : null;
  if (!master) return null;
  const jpeg = await sharp(master).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  return { buf: jpeg, fileName: `${image.property.reference}-photo-${image.sortOrder + 1}.jpg` };
}

export async function setPrimaryImage(actor: Actor, imageId: string) {
  const image = await db.propertyImage.findUnique({ where: { id: imageId }, select: { id: true, propertyId: true } });
  if (!image) throw notFound("Photo");
  await editableProperty(actor, image.propertyId);
  await db.$transaction([
    db.propertyImage.updateMany({ where: { propertyId: image.propertyId }, data: { isPrimary: false } }),
    db.propertyImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]);
  notifyWebsite();
}

export async function reorderImages(actor: Actor, propertyId: string, imageIds: string[]) {
  await editableProperty(actor, propertyId);
  const existing = await db.propertyImage.findMany({ where: { propertyId }, select: { id: true } });
  const known = new Set(existing.map((i) => i.id));
  if (imageIds.length !== known.size || imageIds.some((id) => !known.has(id))) throw invalid("The photo list is out of date. Refresh and try again.");
  await db.$transaction(imageIds.map((id, index) => db.propertyImage.update({ where: { id }, data: { sortOrder: index } })));
  notifyWebsite();
}
