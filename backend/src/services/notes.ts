import "server-only";
import type { EntityType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { isManager, type Actor } from "@/lib/permissions";
import type { NoteTarget } from "@/schemas/note";
import { logActivity } from "./activity";
import { assertCanAccess } from "./access";

const FK: Record<NoteTarget, "leadId" | "clientId" | "ownerId" | "propertyId" | "dealId" | "viewingId"> = {
  lead: "leadId",
  client: "clientId",
  owner: "ownerId",
  property: "propertyId",
  deal: "dealId",
  viewing: "viewingId",
};

const ENTITY: Record<NoteTarget, EntityType> = {
  lead: "LEAD",
  client: "CLIENT",
  owner: "OWNER",
  property: "PROPERTY",
  deal: "DEAL",
  viewing: "VIEWING",
};

export const noteSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.NoteSelect;

export type NoteItem = Prisma.NoteGetPayload<{ select: typeof noteSelect }>;

export function listNotes(target: NoteTarget, targetId: string) {
  return db.note.findMany({ where: { [FK[target]]: targetId }, orderBy: { createdAt: "desc" }, select: noteSelect, take: 100 });
}

async function targetLabel(target: NoteTarget, id: string) {
  switch (target) {
    case "lead":
      return (await db.lead.findUnique({ where: { id }, select: { fullName: true } }))?.fullName;
    case "client":
      return (await db.client.findUnique({ where: { id }, select: { fullName: true } }))?.fullName;
    case "owner":
      return (await db.owner.findUnique({ where: { id }, select: { fullName: true } }))?.fullName;
    case "property": {
      const p = await db.property.findUnique({ where: { id }, select: { reference: true, title: true } });
      return p && `${p.reference} · ${p.title}`;
    }
    case "deal":
      return (await db.deal.findUnique({ where: { id }, select: { reference: true } }))?.reference;
    case "viewing": {
      const v = await db.viewing.findUnique({ where: { id }, select: { property: { select: { reference: true } } } });
      return v && `Viewing of ${v.property.reference}`;
    }
  }
}

export async function addNote(actor: Actor, target: NoteTarget, targetId: string, content: string) {
  await assertCanAccess(actor, target, targetId);
  const label = (await targetLabel(target, targetId)) ?? target;
  return db.$transaction(async (tx) => {
    const note = await tx.note.create({ data: { content, authorId: actor.id, [FK[target]]: targetId }, select: noteSelect });
    await logActivity(tx, {
      action: "NOTE_ADDED", entityType: ENTITY[target], entityId: targetId, entityLabel: label,
      description: `Added a note to ${label}`, userId: actor.id, [FK[target]]: targetId,
    });
    return note;
  });
}

async function ownNote(actor: Actor, id: string) {
  const note = await db.note.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!note) throw notFound("Note");
  if (note.authorId !== actor.id && !isManager(actor)) throw forbidden("You can only change your own notes.");
  return note;
}

export async function updateNote(actor: Actor, id: string, content: string) {
  await ownNote(actor, id);
  return db.note.update({ where: { id }, data: { content }, select: noteSelect });
}

export async function deleteNote(actor: Actor, id: string) {
  await ownNote(actor, id);
  await db.note.delete({ where: { id } });
}
