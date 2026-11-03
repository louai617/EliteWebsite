import "server-only";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { scope, type Actor } from "@/lib/permissions";
import { STAFF_ROLES } from "@/lib/constants";

export type RecordKind = "lead" | "client" | "owner" | "property" | "deal" | "viewing";

/**
 * Throws NOT_FOUND unless the record exists *and* is inside the actor's data scope.
 * Used before attaching notes/tasks/viewings to a record so agents can't reach
 * other agents' data by guessing ids.
 */
export async function assertCanAccess(actor: Actor, kind: RecordKind, id: string) {
  const where = { id };
  let found: { id: string } | null = null;
  switch (kind) {
    case "lead":
      found = await db.lead.findFirst({ where: { ...where, ...scope.leads(actor) }, select: { id: true } });
      break;
    case "client":
      found = await db.client.findFirst({ where: { ...where, ...scope.clients(actor) }, select: { id: true } });
      break;
    case "owner":
      found = await db.owner.findFirst({ where: { ...where, ...scope.owners(actor) }, select: { id: true } });
      break;
    case "property":
      found = await db.property.findFirst({ where: { ...where, ...scope.properties(actor) }, select: { id: true } });
      break;
    case "deal":
      found = await db.deal.findFirst({ where: { ...where, ...scope.deals(actor) }, select: { id: true } });
      break;
    case "viewing":
      found = await db.viewing.findFirst({ where: { ...where, ...scope.viewings(actor) }, select: { id: true } });
      break;
  }
  if (!found) throw notFound(kind[0].toUpperCase() + kind.slice(1));
}

/** Validates optional related ids in one go (skips nulls). */
export async function assertRelated(actor: Actor, related: Partial<Record<RecordKind, string | null | undefined>>) {
  await Promise.all(
    (Object.entries(related) as [RecordKind, string | null | undefined][])
      .filter(([, id]) => Boolean(id))
      .map(([kind, id]) => assertCanAccess(actor, kind, id!)),
  );
}

/** The assignee must be an active staff member (never a client-portal account). */
export async function assertActiveUser(userId: string | null | undefined) {
  if (!userId) return;
  const user = await db.user.findFirst({ where: { id: userId, isActive: true, role: { in: STAFF_ROLES } }, select: { id: true } });
  if (!user) throw notFound("Assigned user");
}
