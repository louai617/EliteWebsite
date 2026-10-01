import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { DealStatus, DealType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { calculateCommission } from "@/lib/commission";
import { can, canAssignTo, isManager, scope, isStaff, type Actor } from "@/lib/permissions";
import { DEAL_STATUS_META } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { like } from "@/lib/search";
import type { dealSchema, updateDealSchema } from "@/schemas/deal";
import { logActivity } from "./activity";
import { onDealWon } from "./automation";
import { assertActiveUser, assertRelated } from "./access";
import { nextReference } from "./references";
import type { Tx } from "./types";

export const DEAL_SORTS = ["createdAt", "amount", "commissionAmount", "closingDate", "closedAt"] as const;

export interface DealFilters {
  status?: DealStatus;
  type?: DealType;
  agentId?: string;
  from?: Date;
  to?: Date;
  open?: boolean;
}

export const dealListSelect = {
  id: true,
  reference: true,
  type: true,
  status: true,
  amount: true,
  commissionPercent: true,
  commissionAmount: true,
  agentCommission: true,
  companyCommission: true,
  contractDate: true,
  closingDate: true,
  closedAt: true,
  createdAt: true,
  property: { select: { id: true, reference: true, title: true, area: true } },
  client: { select: { id: true, fullName: true } },
  agent: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.DealSelect;

export type DealListItem = Prisma.DealGetPayload<{ select: typeof dealListSelect }>;

function dealWhere(actor: Actor, q: string | undefined, f: DealFilters): Prisma.DealWhereInput {
  return {
    AND: [
      scope.deals(actor),
      q
        ? {
            OR: [
              { reference: like(q) },
              { client: { fullName: like(q) } },
              { owner: { fullName: like(q) } },
              { property: { OR: [{ reference: like(q) }, { title: like(q) }, { area: like(q) }] } },
            ],
          }
        : {},
      f.status ? { status: f.status } : {},
      f.open ? { status: { in: ["NEGOTIATION", "CONTRACT_PENDING", "CONTRACT_SIGNED"] } } : {},
      f.type ? { type: f.type } : {},
      f.agentId ? { agentId: f.agentId } : {},
      f.from || f.to ? { createdAt: { gte: f.from, lt: f.to ? new Date(f.to.getTime() + 86_400_000) : undefined } } : {},
    ],
  };
}

export async function listDeals(actor: Actor, params: ListParams<(typeof DEAL_SORTS)[number]>, filters: DealFilters) {
  const where = dealWhere(actor, params.q, filters);
  const [items, total, sums] = await Promise.all([
    db.deal.findMany({ where, orderBy: [{ [params.sort]: params.dir }, { id: "asc" }], ...skipTake(params.page, params.pageSize), select: dealListSelect }),
    db.deal.count({ where }),
    db.deal.aggregate({ where, _sum: { amount: true, commissionAmount: true } }),
  ]);
  return { ...paginate(items, total, params.page, params.pageSize), totals: { amount: sums._sum.amount ?? 0, commission: sums._sum.commissionAmount ?? 0 } };
}

export async function getDeal(actor: Actor, id: string) {
  return db.deal.findFirst({
    where: { id, ...scope.deals(actor) },
    include: {
      property: {
        select: {
          id: true, reference: true, title: true, area: true, status: true, price: true, currency: true, purpose: true, agentId: true,
          images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
        },
      },
      client: { select: { id: true, fullName: true, phone: true, email: true, clientType: true } },
      owner: { select: { id: true, fullName: true, phone: true } },
      lead: { select: { id: true, fullName: true, status: true } },
      agent: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], select: { id: true, title: true, status: true, priority: true, dueDate: true, assignee: { select: { name: true } } } },
    },
  });
}

export type DealDetail = NonNullable<Awaited<ReturnType<typeof getDeal>>>;

/**
 * Keep related records consistent with a deal's status (inside the same transaction):
 *  - Closed won  → property Sold/Rented, lead Won
 *  - Contract pending/signed → property Reserved if it was still available
 */
async function syncSideEffects(tx: Tx, actor: Actor, deal: { id: string; reference: string; status: DealStatus; type: DealType; propertyId: string; leadId: string | null; clientId: string; agentId: string | null }) {
  const property = await tx.property.findUnique({ where: { id: deal.propertyId }, select: { status: true, reference: true, title: true, ownerId: true } });
  if (!property) return;
  const propertyLabel = `${property.reference} · ${property.title}`;
  if (deal.status === "CLOSED_WON") {
    await onDealWon(tx, deal, { id: actor.id, staff: isStaff(actor) });
    const to = deal.type === "RENTAL" ? "RENTED" : "SOLD";
    if (property.status !== to) {
      await tx.property.update({ where: { id: deal.propertyId }, data: { status: to } });
      await logActivity(tx, {
        action: "STATUS_CHANGED", entityType: "PROPERTY", entityId: deal.propertyId, entityLabel: propertyLabel, userId: actor.id,
        description: `${property.reference} marked ${to === "RENTED" ? "Rented" : "Sold"} after ${deal.reference} closed`, propertyId: deal.propertyId, dealId: deal.id,
        meta: { from: property.status, to },
      });
    }
    if (deal.leadId) {
      const lead = await tx.lead.findUnique({ where: { id: deal.leadId }, select: { status: true, fullName: true } });
      if (lead && lead.status !== "WON") {
        await tx.lead.update({ where: { id: deal.leadId }, data: { status: "WON", statusChangedAt: new Date() } });
        await logActivity(tx, {
          action: "STATUS_CHANGED", entityType: "LEAD", entityId: deal.leadId, entityLabel: lead.fullName, userId: actor.id, leadId: deal.leadId, dealId: deal.id,
          description: `Moved ${lead.fullName} to Won after ${deal.reference} closed`, meta: { from: lead.status, to: "WON" },
        });
      }
    }
  } else if ((deal.status === "CONTRACT_PENDING" || deal.status === "CONTRACT_SIGNED") && property.status === "AVAILABLE") {
    await tx.property.update({ where: { id: deal.propertyId }, data: { status: "RESERVED" } });
    await logActivity(tx, {
      action: "STATUS_CHANGED", entityType: "PROPERTY", entityId: deal.propertyId, entityLabel: propertyLabel, userId: actor.id,
      description: `${property.reference} reserved for ${deal.reference}`, propertyId: deal.propertyId, dealId: deal.id, meta: { from: "AVAILABLE", to: "RESERVED" },
    });
  }
}

async function prepare(actor: Actor, input: z.output<typeof dealSchema>) {
  await assertRelated(actor, { property: input.propertyId, client: input.clientId, lead: input.leadId });
  const property = await db.property.findUnique({ where: { id: input.propertyId }, select: { ownerId: true, agentId: true, purpose: true } });
  if (!property) throw notFound("Property");
  if ((input.type === "SALE") !== (property.purpose === "SALE")) {
    throw invalid(`This property is listed for ${property.purpose === "SALE" ? "sale" : "rent"} — choose a ${property.purpose === "SALE" ? "sale" : "rental"} deal.`, { type: ["Doesn't match the listing"] });
  }
  const agentId = input.agentId ?? property.agentId ?? actor.id;
  if (!canAssignTo(actor, agentId)) throw forbidden("You can only create deals for yourself.");
  await assertActiveUser(agentId);
  const breakdown = calculateCommission(input);
  // Link the client's most recent open lead so closing the deal can mark it Won.
  const leadId =
    input.leadId ??
    (await db.lead.findFirst({ where: { clientId: input.clientId, status: { notIn: ["WON", "LOST"] } }, orderBy: { updatedAt: "desc" }, select: { id: true } }))?.id ??
    null;
  return { ...input, ...breakdown, leadId, agentId, ownerId: property.ownerId };
}

export async function createDeal(actor: Actor, input: z.output<typeof dealSchema>) {
  const data = await prepare(actor, input);
  return db.$transaction(async (tx) => {
    const reference = await nextReference(tx, "deal", "DL");
    const closed = data.status === "CLOSED_WON" || data.status === "CLOSED_LOST";
    const deal = await tx.deal.create({
      data: { ...data, reference, closedAt: closed ? new Date() : null },
      select: { id: true, reference: true, status: true, type: true, propertyId: true, leadId: true, clientId: true, agentId: true, amount: true },
    });
    const links = { dealId: deal.id, propertyId: deal.propertyId, clientId: deal.clientId, leadId: deal.leadId };
    await logActivity(tx, {
      action: "CREATED", entityType: "DEAL", entityId: deal.id, entityLabel: deal.reference,
      description: `Opened ${deal.type === "SALE" ? "sale" : "rental"} deal ${deal.reference} worth ${formatMoney(deal.amount)}`, userId: actor.id, ...links,
    });
    if (closed) {
      await logActivity(tx, { action: "CLOSED", entityType: "DEAL", entityId: deal.id, entityLabel: deal.reference, description: `${DEAL_STATUS_META[deal.status].label}: ${deal.reference}`, userId: actor.id, ...links, meta: { to: deal.status } });
    }
    await syncSideEffects(tx, actor, deal);
    return deal;
  });
}

async function scopedDeal(actor: Actor, id: string) {
  const deal = await db.deal.findFirst({ where: { id, ...scope.deals(actor) }, select: { id: true, reference: true, status: true, agentId: true, closedAt: true } });
  if (!deal) throw notFound("Deal");
  return deal;
}

function closedAtFor(prev: { status: DealStatus; closedAt: Date | null }, next: DealStatus) {
  const closed = next === "CLOSED_WON" || next === "CLOSED_LOST";
  if (!closed) return null;
  return prev.status === next && prev.closedAt ? prev.closedAt : new Date();
}

export async function updateDeal(actor: Actor, input: z.output<typeof updateDealSchema>) {
  const { id, ...rest } = input;
  const current = await scopedDeal(actor, id);
  if (!isManager(actor) && rest.agentId !== current.agentId && rest.agentId !== null) throw forbidden("Only managers can reassign deals.");
  const data = await prepare(actor, { ...rest, agentId: rest.agentId ?? current.agentId });
  return db.$transaction(async (tx) => {
    const deal = await tx.deal.update({
      where: { id },
      data: { ...data, closedAt: closedAtFor(current, data.status) },
      select: { id: true, reference: true, status: true, type: true, propertyId: true, leadId: true, clientId: true, agentId: true },
    });
    const links = { dealId: id, propertyId: deal.propertyId, clientId: deal.clientId, leadId: deal.leadId };
    if (current.status !== deal.status) {
      const closed = deal.status === "CLOSED_WON" || deal.status === "CLOSED_LOST";
      await logActivity(tx, {
        action: closed ? "CLOSED" : "STATUS_CHANGED", entityType: "DEAL", entityId: id, entityLabel: deal.reference, userId: actor.id, ...links,
        description: `${deal.reference}: ${DEAL_STATUS_META[current.status].label} → ${DEAL_STATUS_META[deal.status].label}`, meta: { from: current.status, to: deal.status },
      });
      await syncSideEffects(tx, actor, deal);
    }
    await logActivity(tx, { action: "UPDATED", entityType: "DEAL", entityId: id, entityLabel: deal.reference, description: `Updated deal ${deal.reference}`, userId: actor.id, ...links });
    return deal;
  });
}

export async function setDealStatus(actor: Actor, id: string, status: DealStatus) {
  const current = await scopedDeal(actor, id);
  if (current.status === status) return current;
  return db.$transaction(async (tx) => {
    const deal = await tx.deal.update({
      where: { id },
      data: { status, closedAt: closedAtFor(current, status), ...(status === "CONTRACT_SIGNED" ? { contractDate: new Date() } : {}) },
      select: { id: true, reference: true, status: true, type: true, propertyId: true, leadId: true, clientId: true, agentId: true },
    });
    const closed = status === "CLOSED_WON" || status === "CLOSED_LOST";
    await logActivity(tx, {
      action: closed ? "CLOSED" : "STATUS_CHANGED", entityType: "DEAL", entityId: id, entityLabel: deal.reference, userId: actor.id,
      dealId: id, propertyId: deal.propertyId, clientId: deal.clientId, leadId: deal.leadId,
      description: `${deal.reference}: ${DEAL_STATUS_META[current.status].label} → ${DEAL_STATUS_META[status].label}`, meta: { from: current.status, to: status },
    });
    await syncSideEffects(tx, actor, deal);
    return deal;
  });
}

export async function deleteDeal(actor: Actor, id: string) {
  if (!can.deleteRecords(actor)) throw forbidden("Only managers can delete deals.");
  const deal = await db.deal.findUnique({ where: { id }, select: { reference: true, propertyId: true, clientId: true } });
  if (!deal) throw notFound("Deal");
  await db.$transaction(async (tx) => {
    await tx.deal.delete({ where: { id } });
    await logActivity(tx, { action: "DELETED", entityType: "DEAL", entityId: id, entityLabel: deal.reference, description: `Deleted deal ${deal.reference}`, userId: actor.id, propertyId: deal.propertyId, clientId: deal.clientId });
  });
}
