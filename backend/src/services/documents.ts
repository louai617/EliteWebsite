import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { DocumentKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { isManager, isStaff, scope, type Actor } from "@/lib/permissions";
import { DOCUMENT_KIND_META } from "@/lib/constants";
import type { DocumentTarget, documentMetaSchema } from "@/schemas/document";
import { logActivity } from "./activity";
import { assertCanAccess } from "./access";
import { deleteDocumentFile, readDocumentFile, safeFileName, saveDocumentFile } from "./storage";

/**
 * Documents attached to leads, clients, deals and reservations.
 *
 *  - Staff see a document when they can see any record it is attached to (agents: their own
 *    leads/clients/deals; managers: everything).
 *  - Clients see documents on their own client file and their own reservations (viewing
 *    forms stay internal).
 *  - Only managers delete documents, and every upload/delete is in the activity log: the
 *    viewing / booking paperwork is what lets a lead move forward.
 */

export const documentSelect = {
  id: true,
  kind: true,
  title: true,
  number: true,
  expiresAt: true,
  fileName: true,
  mimeType: true,
  size: true,
  uploadedByClient: true,
  createdAt: true,
  leadId: true,
  clientId: true,
  dealId: true,
  reservationId: true,
  uploadedBy: { select: { name: true } },
} satisfies Prisma.DocumentSelect;

export type DocumentItem = Prisma.DocumentGetPayload<{ select: typeof documentSelect }>;

async function assertTargetAccess(actor: Actor, target: DocumentTarget, targetId: string) {
  if (target === "reservation") {
    const reservation = await db.reservation.findFirst({
      where: { id: targetId, ...(isManager(actor) ? {} : { OR: [{ agentId: actor.id }, { client: { agentId: actor.id } }] }) },
      select: { id: true, clientId: true },
    });
    if (!reservation) throw notFound("Reservation");
    return { reservationId: reservation.id, clientId: reservation.clientId };
  }
  await assertCanAccess(actor, target, targetId);
  if (target === "lead") return { leadId: targetId };
  if (target === "client") return { clientId: targetId };
  // A deal's documents also land on the client's (or lead's) file.
  const deal = await db.deal.findUniqueOrThrow({ where: { id: targetId }, select: { clientId: true, leadId: true } });
  return { dealId: targetId, clientId: deal.clientId, leadId: deal.leadId };
}

function label(kind: DocumentKind, title: string | null) {
  return title ? `${DOCUMENT_KIND_META[kind].label} (${title})` : DOCUMENT_KIND_META[kind].label;
}

/** Staff upload (CRM). */
export async function uploadDocument(actor: Actor, input: z.output<typeof documentMetaSchema> & { file: File }) {
  if (!isStaff(actor)) throw forbidden();
  const links = await assertTargetAccess(actor, input.target, input.targetId);
  const saved = await saveDocumentFile(input.file); // validates type and size first
  try {
    return await db.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          kind: input.kind, title: input.title, number: input.number, expiresAt: input.expiresAt,
          fileName: safeFileName(input.file.name, saved.mimeType), mimeType: saved.mimeType, size: saved.size, storageKey: saved.storageKey,
          uploadedById: actor.id, ...links,
        },
        select: documentSelect,
      });
      await logActivity(tx, {
        action: "CREATED", entityType: "DOCUMENT", entityId: doc.id, entityLabel: label(doc.kind, doc.title), userId: actor.id,
        description: `Uploaded ${label(doc.kind, doc.title).toLowerCase()} — ${doc.fileName}`,
        leadId: doc.leadId, clientId: doc.clientId, dealId: doc.dealId,
      });
      return doc;
    });
  } catch (error) {
    await deleteDocumentFile(saved.storageKey);
    throw error;
  }
}

/** Documents of one record, newest first (the caller has already loaded the record in scope). */
export async function listDocuments(actor: Actor, target: DocumentTarget, targetId: string) {
  await assertTargetAccess(actor, target, targetId);
  const where: Prisma.DocumentWhereInput =
    target === "lead"
      ? { leadId: targetId }
      : target === "client"
        ? { OR: [{ clientId: targetId }, { reservation: { clientId: targetId } }] }
        : target === "deal"
          ? { dealId: targetId }
          : { reservationId: targetId };
  return db.document.findMany({ where, orderBy: { createdAt: "desc" }, select: documentSelect });
}

export async function deleteDocument(actor: Actor, id: string) {
  if (!isManager(actor)) throw forbidden("Only managers can delete documents.");
  const doc = await db.document.findUnique({ where: { id }, select: { id: true, kind: true, title: true, fileName: true, storageKey: true, leadId: true, clientId: true, dealId: true } });
  if (!doc) throw notFound("Document");
  await db.$transaction(async (tx) => {
    await tx.document.delete({ where: { id } });
    await logActivity(tx, {
      action: "DELETED", entityType: "DOCUMENT", entityId: id, entityLabel: label(doc.kind, doc.title), userId: actor.id,
      description: `Deleted ${label(doc.kind, doc.title).toLowerCase()} — ${doc.fileName}`, leadId: doc.leadId, clientId: doc.clientId, dealId: doc.dealId,
    });
  });
  await deleteDocumentFile(doc.storageKey);
}

/** Permission check + file read for GET /api/documents/:id. Returns null when not allowed. */
export async function openDocument(user: Actor, id: string) {
  const doc = await db.document.findUnique({
    where: { id },
    select: { id: true, kind: true, fileName: true, mimeType: true, storageKey: true, leadId: true, clientId: true, dealId: true, reservation: { select: { clientId: true, agentId: true } } },
  });
  if (!doc) return null;
  let allowed = false;
  if (isStaff(user)) {
    if (isManager(user)) allowed = true;
    else {
      const checks = await Promise.all([
        doc.leadId ? db.lead.count({ where: { id: doc.leadId, ...scope.leads(user) } }) : 0,
        doc.clientId ? db.client.count({ where: { id: doc.clientId, ...scope.clients(user) } }) : 0,
        doc.dealId ? db.deal.count({ where: { id: doc.dealId, ...scope.deals(user) } }) : 0,
      ]);
      allowed = checks.some(Boolean) || doc.reservation?.agentId === user.id;
    }
  }
  if (!allowed) return null;
  const buf = await readDocumentFile(doc.storageKey);
  return buf ? { buf, fileName: doc.fileName, mimeType: doc.mimeType } : null;
}
