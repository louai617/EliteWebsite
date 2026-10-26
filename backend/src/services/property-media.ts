import "server-only";
import type { z } from "zod";
import type { MediaKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { invalid, notFound } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { parseMediaLink } from "@/lib/media-links";
import type { mediaLinkSchema } from "@/schemas/media";
import { logActivity } from "./activity";
import { editableProperty } from "./properties";
import { deleteMediaFile, MEDIA_RULES, saveMediaStream, type UploadableMediaKind } from "./storage";
import { notifyWebsite } from "./website-sync";

/**
 * Listing media beyond photos: videos (uploaded or YouTube/Vimeo), 360° virtual tours
 * (Matterport, Kuula or any link), floor plans and a brochure. Same edit rights as photos.
 * Uploaded files are served by /api/media/:id — publicly only while the listing is live.
 */

export const MEDIA_LABEL: Record<MediaKind, string> = { VIDEO: "video", VIRTUAL_TOUR: "360° tour", FLOOR_PLAN: "floor plan", BROCHURE: "brochure" };
const MAX_PER_KIND = 12;

export const mediaSelect = {
  id: true, kind: true, title: true, url: true, provider: true, embedUrl: true, storageKey: true, mimeType: true, size: true, sortOrder: true, createdAt: true,
} as const;

/** Path of an uploaded file (relative to the agent app). */
export const mediaPath = (id: string) => `/api/media/${id}`;

async function nextSort(propertyId: string, kind: MediaKind) {
  const count = await db.propertyMedia.count({ where: { propertyId, kind } });
  if (count >= MAX_PER_KIND) throw invalid(`A listing can have up to ${MAX_PER_KIND} of each media type.`);
  const last = await db.propertyMedia.findFirst({ where: { propertyId, kind }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (last?.sortOrder ?? -1) + 1;
}

async function record(actor: Actor, property: { id: string; reference: string; title: string }, kind: MediaKind, how: string) {
  await logActivity(db, {
    action: "UPDATED", entityType: "PROPERTY", entityId: property.id, entityLabel: `${property.reference} · ${property.title}`, userId: actor.id, propertyId: property.id,
    description: `${how} a ${MEDIA_LABEL[kind]} on ${property.reference}`,
  });
  notifyWebsite();
}

export async function addMediaLink(actor: Actor, input: z.output<typeof mediaLinkSchema>) {
  const property = await editableProperty(actor, input.propertyId);
  const parsed = parseMediaLink(input.url);
  if (!parsed) throw invalid("Use a secure link that starts with https://", { url: ["https:// link required"] });
  if (input.kind === "VIDEO" && parsed.provider !== "youtube" && parsed.provider !== "vimeo" && parsed.provider !== "link") {
    throw invalid("That looks like a virtual tour — choose “360° tour”.", { kind: ["Choose 360° tour"] });
  }
  const sortOrder = await nextSort(property.id, input.kind);
  const media = await db.propertyMedia.create({
    data: { propertyId: property.id, kind: input.kind, title: input.title, url: parsed.url, provider: parsed.provider, embedUrl: parsed.embedUrl, sortOrder, createdById: actor.id },
    select: mediaSelect,
  });
  await record(actor, property, input.kind, "Added");
  return media;
}

/** Streaming upload (videos up to 200 MB). Rights are checked before a byte is written. */
export async function uploadMedia(actor: Actor, propertyId: string, kind: UploadableMediaKind, title: string | null, body: ReadableStream<Uint8Array> | null) {
  const property = await editableProperty(actor, propertyId);
  if (!body) throw invalid(`Choose a file (${MEDIA_RULES[kind].label}).`, { file: ["Missing file"] });
  const sortOrder = await nextSort(property.id, kind);
  const saved = await saveMediaStream(property.id, kind, body);
  try {
    const media = await db.propertyMedia.create({
      data: { propertyId: property.id, kind, title, provider: "file", storageKey: saved.storageKey, mimeType: saved.mimeType, size: saved.size, sortOrder, createdById: actor.id },
      select: mediaSelect,
    });
    await record(actor, property, kind, "Uploaded");
    return media;
  } catch (error) {
    await deleteMediaFile(saved.storageKey);
    throw error;
  }
}

export async function deleteMedia(actor: Actor, id: string) {
  const media = await db.propertyMedia.findUnique({ where: { id }, select: { id: true, kind: true, propertyId: true, storageKey: true } });
  if (!media) throw notFound("Media");
  const property = await editableProperty(actor, media.propertyId);
  await db.propertyMedia.delete({ where: { id } });
  if (media.storageKey) await deleteMediaFile(media.storageKey);
  await record(actor, property, media.kind, "Removed");
}

/** Moves an item one place up/down within its type. */
export async function moveMedia(actor: Actor, id: string, direction: "up" | "down") {
  const media = await db.propertyMedia.findUnique({ where: { id }, select: { id: true, kind: true, propertyId: true, sortOrder: true } });
  if (!media) throw notFound("Media");
  await editableProperty(actor, media.propertyId);
  const siblings = await db.propertyMedia.findMany({ where: { propertyId: media.propertyId, kind: media.kind }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = siblings.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await db.$transaction(siblings.map((s, index) => db.propertyMedia.update({ where: { id: s.id }, data: { sortOrder: index } })));
  notifyWebsite();
}

/** Media of a property for the agent app. */
export function listMedia(propertyId: string) {
  return db.propertyMedia.findMany({ where: { propertyId }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }], select: mediaSelect });
}

export type MediaItem = Awaited<ReturnType<typeof listMedia>>[number];
