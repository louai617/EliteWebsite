import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { ViewingStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { canAssignTo, isManager, scope, type Actor } from "@/lib/permissions";
import { VIEWING_STATUS_META } from "@/lib/constants";
import { formatDateTime, zonedDayStart } from "@/lib/format";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { like } from "@/lib/search";
import type { updateViewingSchema, viewingSchema } from "@/schemas/viewing";
import { logActivity } from "./activity";
import { assertActiveUser, assertRelated } from "./access";
import type { Tx } from "./types";

export const VIEWING_SORTS = ["startsAt", "createdAt"] as const;
const ACTIVE: ViewingStatus[] = ["SCHEDULED", "CONFIRMED"];

export interface ViewingFilters {
  status?: ViewingStatus;
  agentId?: string;
  from?: Date;
  to?: Date;
  propertyId?: string;
  upcoming?: boolean;
}

export const viewingSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  notes: true,
  propertyId: true,
  leadId: true,
  clientId: true,
  agentId: true,
  property: { select: { id: true, reference: true, title: true, area: true } },
  lead: { select: { id: true, fullName: true, phone: true } },
  client: { select: { id: true, fullName: true, phone: true } },
  agent: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.ViewingSelect;

export type ViewingItem = Prisma.ViewingGetPayload<{ select: typeof viewingSelect }>;

function viewingWhere(actor: Actor, q: string | undefined, f: ViewingFilters): Prisma.ViewingWhereInput {
  return {
    AND: [
      scope.viewings(actor),
      q
        ? {
            OR: [
              { property: { OR: [{ reference: like(q) }, { title: like(q) }, { area: like(q) }] } },
              { lead: { fullName: like(q) } },
              { client: { fullName: like(q) } },
            ],
          }
        : {},
      f.status ? { status: f.status } : {},
      f.agentId ? { agentId: f.agentId } : {},
      f.propertyId ? { propertyId: f.propertyId } : {},
      f.from || f.to ? { startsAt: { gte: f.from, lt: f.to ? new Date(f.to.getTime() + 86_400_000) : undefined } } : {},
      f.upcoming ? { startsAt: { gte: zonedDayStart() }, status: { in: ACTIVE } } : {},
    ],
  };
}


export async function listViewings(actor: Actor, params: ListParams<(typeof VIEWING_SORTS)[number]>, filters: ViewingFilters) {
  const where = viewingWhere(actor, params.q, filters);
  const [items, total] = await Promise.all([
    db.viewing.findMany({ where, orderBy: [{ [params.sort]: params.dir }, { id: "asc" }], ...skipTake(params.page, params.pageSize), select: viewingSelect }),
    db.viewing.count({ where }),
  ]);
  return paginate(items, total, params.page, params.pageSize);
}

/** All viewings in a date window (calendar views). */
export function viewingsBetween(actor: Actor, start: Date, end: Date, filters: Omit<ViewingFilters, "from" | "to"> = {}) {
  return db.viewing.findMany({
    where: { AND: [viewingWhere(actor, undefined, filters), { startsAt: { gte: start, lt: end } }] },
    orderBy: { startsAt: "asc" },
    select: viewingSelect,
    take: 500,
  });
}

export function upcomingViewings(actor: Actor, take = 6) {
  return db.viewing.findMany({
    where: { AND: [scope.viewings(actor), { startsAt: { gte: new Date(Date.now() - 60 * 60_000) }, status: { in: ACTIVE } }] },
    orderBy: { startsAt: "asc" },
    take,
    select: viewingSelect,
  });
}

export async function getViewing(actor: Actor, id: string) {
  return db.viewing.findFirst({ where: { id, ...scope.viewings(actor) }, select: { ...viewingSelect, createdAt: true, updatedAt: true } });
}

async function assertNoClash(tx: Tx, agentId: string | null, startsAt: Date, endsAt: Date, excludeId?: string) {
  if (!agentId) return;
  const clash = await tx.viewing.findFirst({
    where: {
      agentId,
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: ACTIVE },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { startsAt: true, property: { select: { reference: true } } },
  });
  if (clash) {
    throw conflict(`This agent already has a viewing of ${clash.property.reference} at ${formatDateTime(clash.startsAt)}.`, { startsAt: ["Overlaps another viewing"] });
  }
}

async function labelFor(tx: Tx, propertyId: string, leadId: string | null, clientId: string | null) {
  const [property, lead, client] = await Promise.all([
    tx.property.findUnique({ where: { id: propertyId }, select: { reference: true } }),
    leadId ? tx.lead.findUnique({ where: { id: leadId }, select: { fullName: true, status: true } }) : null,
    clientId ? tx.client.findUnique({ where: { id: clientId }, select: { fullName: true } }) : null,
  ]);
  const who = lead?.fullName ?? client?.fullName ?? "a client";
  return { ref: property?.reference ?? "property", who, leadStatus: lead?.status ?? null };
}

export async function createViewing(actor: Actor, input: z.output<typeof viewingSchema>) {
  await assertRelated(actor, { property: input.propertyId, lead: input.leadId, client: input.clientId });
  const agentId = input.agentId ?? actor.id;
  if (!canAssignTo(actor, agentId)) throw forbidden("You can only schedule viewings for yourself.");
  await assertActiveUser(agentId);

  return db.$transaction(async (tx) => {
    await assertNoClash(tx, agentId, input.startsAt, input.endsAt);
    const viewing = await tx.viewing.create({ data: { ...input, agentId }, select: { id: true } });
    const { ref, who, leadStatus } = await labelFor(tx, input.propertyId, input.leadId, input.clientId);
    const links = { viewingId: viewing.id, propertyId: input.propertyId, leadId: input.leadId, clientId: input.clientId };
    await logActivity(tx, {
      action: "CREATED", entityType: "VIEWING", entityId: viewing.id, entityLabel: `${ref} with ${who}`,
      description: `Scheduled viewing of ${ref} with ${who} on ${formatDateTime(input.startsAt)}`, userId: actor.id, ...links,
    });
    if (input.leadId) {
      await tx.propertyInterest.upsert({
        where: { propertyId_leadId: { propertyId: input.propertyId, leadId: input.leadId } },
        create: { propertyId: input.propertyId, leadId: input.leadId },
        update: {},
      });
      // Advance early-stage leads automatically.
      if (leadStatus && ["NEW", "CONTACTED", "QUALIFIED"].includes(leadStatus)) {
        await tx.lead.update({ where: { id: input.leadId }, data: { status: "VIEWING_SCHEDULED", statusChangedAt: new Date() } });
        await logActivity(tx, {
          action: "STATUS_CHANGED", entityType: "LEAD", entityId: input.leadId, entityLabel: who, userId: actor.id, leadId: input.leadId,
          description: `Moved ${who} to Viewing after scheduling ${ref}`, meta: { from: leadStatus, to: "VIEWING_SCHEDULED" },
        });
      }
    }
    return viewing;
  });
}

async function scopedViewing(actor: Actor, id: string) {
  const viewing = await db.viewing.findFirst({ where: { id, ...scope.viewings(actor) }, select: { id: true, status: true, agentId: true, propertyId: true, leadId: true, clientId: true, startsAt: true } });
  if (!viewing) throw notFound("Viewing");
  return viewing;
}

export async function updateViewing(actor: Actor, input: z.output<typeof updateViewingSchema>) {
  const { id, ...data } = input;
  const current = await scopedViewing(actor, id);
  if (!isManager(actor) && data.agentId !== current.agentId) throw forbidden("Only managers can reassign viewings.");
  await assertRelated(actor, { property: data.propertyId, lead: data.leadId, client: data.clientId });
  await assertActiveUser(data.agentId);
  return db.$transaction(async (tx) => {
    if (ACTIVE.includes(data.status)) await assertNoClash(tx, data.agentId, data.startsAt, data.endsAt, id);
    const viewing = await tx.viewing.update({ where: { id }, data, select: { id: true } });
    const { ref, who } = await labelFor(tx, data.propertyId, data.leadId, data.clientId);
    await logActivity(tx, {
      action: current.status !== data.status ? "STATUS_CHANGED" : "UPDATED", entityType: "VIEWING", entityId: id, entityLabel: `${ref} with ${who}`,
      description: current.status !== data.status ? `Viewing of ${ref} with ${who} is now ${VIEWING_STATUS_META[data.status].label.toLowerCase()}` : `Updated viewing of ${ref} with ${who}`,
      userId: actor.id, viewingId: id, propertyId: data.propertyId, leadId: data.leadId, clientId: data.clientId,
    });
    return viewing;
  });
}

export async function setViewingStatus(actor: Actor, id: string, status: ViewingStatus, notes?: string | null) {
  const current = await scopedViewing(actor, id);
  if (current.status === status && notes === undefined) return current;
  return db.$transaction(async (tx) => {
    const viewing = await tx.viewing.update({ where: { id }, data: { status, ...(notes !== undefined ? { notes } : {}) }, select: { id: true, status: true } });
    const { ref, who } = await labelFor(tx, current.propertyId, current.leadId, current.clientId);
    const action = status === "COMPLETED" ? "COMPLETED" : status === "CANCELLED" ? "CANCELLED" : "STATUS_CHANGED";
    const verb = status === "COMPLETED" ? "Completed" : status === "CANCELLED" ? "Cancelled" : status === "NO_SHOW" ? "Marked no-show for" : status === "CONFIRMED" ? "Confirmed" : "Rescheduled";
    await logActivity(tx, {
      action, entityType: "VIEWING", entityId: id, entityLabel: `${ref} with ${who}`,
      description: `${verb} viewing of ${ref} with ${who}`, userId: actor.id,
      viewingId: id, propertyId: current.propertyId, leadId: current.leadId, clientId: current.clientId, meta: { from: current.status, to: status },
    });
    return viewing;
  });
}

export async function deleteViewing(actor: Actor, id: string) {
  const current = await scopedViewing(actor, id);
  await db.$transaction(async (tx) => {
    const { ref, who } = await labelFor(tx, current.propertyId, current.leadId, current.clientId);
    await tx.viewing.delete({ where: { id } });
    await logActivity(tx, {
      action: "DELETED", entityType: "VIEWING", entityId: id, entityLabel: `${ref} with ${who}`, description: `Deleted viewing of ${ref} with ${who}`,
      userId: actor.id, propertyId: current.propertyId, leadId: current.leadId, clientId: current.clientId,
    });
  });
}
