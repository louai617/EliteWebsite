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
import { notifyWebsite } from "./website-sync";
import { onDealWon } from "./automation";
import { convertLeadInTx } from "./lead-conversion";
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
  lead: { select: { id: true, fullName: true } },
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
              { lead: { fullName: like(q) } },
              { owner: { fullName: like(q) } },
              { property: { OR: [{ reference: like(q) }, { title: like(q) }, { area: like(q) }] } },
            ],
          }
        : {},
      f.status ? { status: f.status } : {},
      f.open ? { status: "PENDING_CONTRACT" } : {},
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
          images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, thumbUrl: true } },
        },
      },
      client: { select: { id: true, fullName: true, phone: true, email: true, clientType: true } },
      owner: { select: { id: true, fullName: true, phone: true } },
      lead: { select: { id: true, fullName: true, status: true, phone: true, email: true, nationality: true, clientId: true } },
      agent: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      contracts: { orderBy: { createdAt: "desc" }, select: { id: true, reference: true, title: true, templateName: true, createdAt: true, createdBy: { select: { name: true } } } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], select: { id: true, title: true, status: true, priority: true, dueDate: true, assignee: { select: { name: true } } } },
    },
  });
}

export type DealDetail = NonNullable<Awaited<ReturnType<typeof getDeal>>>;

type DealCore = { id: string; reference: string; status: DealStatus; type: DealType; propertyId: string; leadId: string | null; clientId: string | null; agentId: string | null };
const dealCoreSelect = { id: true, reference: true, status: true, type: true, propertyId: true, leadId: true, clientId: true, agentId: true } as const;

async function setPropertyStatus(tx: Tx, actor: Actor, deal: DealCore, to: "SOLD" | "RENTED" | "RESERVED" | "AVAILABLE", why: string) {
  const property = await tx.property.findUnique({ where: { id: deal.propertyId }, select: { status: true, reference: true, title: true } });
  if (!property || property.status === to) return;
  // Only move between the states a deal controls; never touch an off-market listing.
  if (to === "RESERVED" && property.status !== "AVAILABLE") return;
  if (to === "AVAILABLE" && property.status !== "RESERVED") return;
  if (to === "AVAILABLE") {
    const holding = await tx.deal.count({ where: { propertyId: deal.propertyId, status: "PENDING_CONTRACT", id: { not: deal.id } } });
    const reserved = await tx.reservation.count({ where: { propertyId: deal.propertyId, status: "CONFIRMED" } });
    if (holding || reserved) return;
  }
  await tx.property.update({ where: { id: deal.propertyId }, data: { status: to } });
  notifyWebsite();
  await logActivity(tx, {
    action: "STATUS_CHANGED", entityType: "PROPERTY", entityId: deal.propertyId, entityLabel: `${property.reference} · ${property.title}`, userId: actor.id,
    description: `${property.reference} marked ${to.charAt(0) + to.slice(1).toLowerCase()} — ${why}`, propertyId: deal.propertyId, dealId: deal.id,
    meta: { from: property.status, to },
  });
}

/**
 * Closing a deal: the lead becomes a client (with its documents), the property is marked
 * Sold/Rented, the lead is Won and the office gets a task to complete the client's file.
 */
async function closeInTx(tx: Tx, actor: Actor, deal: DealCore) {
  let clientId = deal.clientId;
  if (!clientId) {
    if (!deal.leadId) throw invalid("Link this deal to a lead or client before closing it.");
    clientId = (await convertLeadInTx(tx, deal.leadId, actor.id)).clientId;
  } else if (deal.leadId) {
    await convertLeadInTx(tx, deal.leadId, actor.id); // links documents of an already-linked lead
  }
  await tx.deal.update({ where: { id: deal.id }, data: { clientId } });
  await tx.document.updateMany({ where: { dealId: deal.id, clientId: null }, data: { clientId } });
  await onDealWon(tx, { ...deal, clientId }, { id: actor.id, staff: isStaff(actor) });
  await setPropertyStatus(tx, actor, deal, deal.type === "RENTAL" ? "RENTED" : "SOLD", `${deal.reference} closed`);
  if (deal.leadId) {
    const lead = await tx.lead.findUnique({ where: { id: deal.leadId }, select: { status: true, fullName: true } });
    if (lead && lead.status !== "WON") {
      await tx.lead.update({ where: { id: deal.leadId }, data: { status: "WON", statusChangedAt: new Date(), lostReason: null } });
      await logActivity(tx, {
        action: "STATUS_CHANGED", entityType: "LEAD", entityId: deal.leadId, entityLabel: lead.fullName, userId: actor.id, leadId: deal.leadId, dealId: deal.id,
        description: `Moved ${lead.fullName} to Won after ${deal.reference} closed`, meta: { from: lead.status, to: "WON" },
      });
    }
  }
  const client = await tx.client.findUniqueOrThrow({ where: { id: clientId }, select: { fullName: true, agentId: true } });
  const autoKey = `client-documents:${clientId}`;
  if (!(await tx.task.findUnique({ where: { autoKey }, select: { id: true } }))) {
    await tx.task.create({
      data: {
        title: `Add documents for new client ${client.fullName}`,
        description: `${deal.reference} closed. Upload the client's QID / passport and the signed contract on the client's page.`,
        type: "CLIENT_FOLLOW_UP",
        priority: "MEDIUM",
        dueDate: new Date(Date.now() + 2 * 24 * 3_600_000),
        clientId,
        dealId: deal.id,
        assigneeId: actor.id,
        createdById: actor.id,
        autoKey,
        events: { create: { type: "CREATED", actorId: actor.id, message: "Created automatically when the deal closed" } },
      },
    });
  }
  return clientId;
}

/** Cancelling: the listing is released and the lead is marked Lost with the reason. */
async function cancelInTx(tx: Tx, actor: Actor, deal: DealCore, reason: string) {
  await setPropertyStatus(tx, actor, deal, "AVAILABLE", `${deal.reference} was cancelled`);
  if (deal.leadId) {
    const lead = await tx.lead.findUnique({ where: { id: deal.leadId }, select: { status: true, fullName: true } });
    if (lead && lead.status !== "LOST") {
      const lostReason = `Deal ${deal.reference} cancelled: ${reason}`;
      await tx.lead.update({ where: { id: deal.leadId }, data: { status: "LOST", statusChangedAt: new Date(), lostReason } });
      await logActivity(tx, {
        action: "STATUS_CHANGED", entityType: "LEAD", entityId: deal.leadId, entityLabel: lead.fullName, userId: actor.id, leadId: deal.leadId, dealId: deal.id,
        description: `Moved ${lead.fullName} to Lost — ${lostReason}`, meta: { from: lead.status, to: "LOST" },
      });
    }
  }
  await tx.task.updateMany({ where: { dealId: deal.id, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
}

/** A won lead opens its deal here (inside the lead's transaction). Always Pending contract. */
export async function openDealInTx(
  tx: Tx,
  actor: Actor,
  input: { leadId: string; clientId: string | null; propertyId: string; agentId: string | null; amount: number; notes: string | null },
) {
  const property = await tx.property.findUniqueOrThrow({ where: { id: input.propertyId }, select: { purpose: true, ownerId: true, agentId: true } });
  const cfg = await tx.settings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  const type: DealType = property.purpose === "SALE" ? "SALE" : "RENTAL";
  const commissionPercent = type === "SALE" ? cfg.saleCommissionPercent : cfg.rentalCommissionPercent;
  const breakdown = calculateCommission({ amount: input.amount, commissionPercent, agentSharePercent: cfg.agentSharePercent });
  const reference = await nextReference(tx, "deal", "DL");
  const deal = await tx.deal.create({
    data: {
      reference,
      type,
      status: "PENDING_CONTRACT",
      propertyId: input.propertyId,
      leadId: input.leadId,
      clientId: input.clientId,
      ownerId: property.ownerId,
      agentId: input.agentId ?? property.agentId ?? actor.id,
      amount: input.amount,
      commissionPercent,
      agentSharePercent: cfg.agentSharePercent,
      ...breakdown,
      notes: input.notes,
    },
    select: dealCoreSelect,
  });
  await logActivity(tx, {
    action: "CREATED", entityType: "DEAL", entityId: deal.id, entityLabel: deal.reference, userId: actor.id,
    description: `Opened ${type === "SALE" ? "sale" : "rental"} deal ${deal.reference} worth ${formatMoney(input.amount)} (pending contract)`,
    dealId: deal.id, propertyId: deal.propertyId, leadId: deal.leadId, clientId: deal.clientId,
  });
  await setPropertyStatus(tx, actor, deal, "RESERVED", `booked under ${deal.reference}`);
  if (deal.agentId) {
    await tx.task.create({
      data: {
        title: `Prepare the contract for ${deal.reference}`,
        description: "Generate the contract from the deal page (Contracts → Generate), get it signed, then ask the office to close the deal.",
        type: "CLIENT_FOLLOW_UP",
        priority: "HIGH",
        dueDate: new Date(Date.now() + 3 * 24 * 3_600_000),
        dealId: deal.id,
        leadId: deal.leadId,
        propertyId: deal.propertyId,
        assigneeId: deal.agentId,
        createdById: actor.id,
        autoKey: `prepare-contract:${deal.id}`,
        events: { create: { type: "CREATED", actorId: actor.id, message: "Created automatically when the lead was won" } },
      },
    });
  }
  return deal;
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
  return { ...input, ...breakdown, agentId, ownerId: property.ownerId };
}

/**
 * Manual deal (managers only — agents open deals by marking a lead Won with its booking form
 * and proof of payment). Always starts as Pending contract.
 */
export async function createDeal(actor: Actor, input: z.output<typeof dealSchema>) {
  if (!isManager(actor)) throw forbidden("Deals open automatically when you mark a lead as Won.");
  const data = await prepare(actor, input);
  return db.$transaction(async (tx) => {
    const reference = await nextReference(tx, "deal", "DL");
    const deal = await tx.deal.create({ data: { ...data, reference, status: "PENDING_CONTRACT" }, select: { ...dealCoreSelect, amount: true } });
    await logActivity(tx, {
      action: "CREATED", entityType: "DEAL", entityId: deal.id, entityLabel: deal.reference,
      description: `Opened ${deal.type === "SALE" ? "sale" : "rental"} deal ${deal.reference} worth ${formatMoney(deal.amount)}`, userId: actor.id,
      dealId: deal.id, propertyId: deal.propertyId, clientId: deal.clientId, leadId: deal.leadId,
    });
    await setPropertyStatus(tx, actor, deal, "RESERVED", `booked under ${deal.reference}`);
    return deal;
  });
}

async function scopedDeal(actor: Actor, id: string) {
  const deal = await db.deal.findFirst({ where: { id, ...scope.deals(actor) }, select: { ...dealCoreSelect, closedAt: true } });
  if (!deal) throw notFound("Deal");
  return deal;
}

/** Edit amounts, dates, notes and links. The status changes through setDealStatus only. */
export async function updateDeal(actor: Actor, input: z.output<typeof updateDealSchema>) {
  const { id, ...rest } = input;
  const current = await scopedDeal(actor, id);
  if (!isManager(actor) && rest.agentId !== current.agentId && rest.agentId !== null) throw forbidden("Only managers can reassign deals.");
  if (current.status === "CLOSED" && !isManager(actor)) throw forbidden("Closed deals can only be edited by a manager.");
  const data = await prepare(actor, { ...rest, agentId: rest.agentId ?? current.agentId });
  return db.$transaction(async (tx) => {
    const deal = await tx.deal.update({ where: { id }, data, select: dealCoreSelect });
    await logActivity(tx, {
      action: "UPDATED", entityType: "DEAL", entityId: id, entityLabel: deal.reference, description: `Updated deal ${deal.reference}`, userId: actor.id,
      dealId: id, propertyId: deal.propertyId, clientId: deal.clientId, leadId: deal.leadId,
    });
    return deal;
  });
}

/** Managers move a deal between Pending contract, Closed and Cancelled. */
export async function setDealStatus(actor: Actor, id: string, status: DealStatus, reason?: string | null) {
  if (!isManager(actor)) throw forbidden("Only managers can close or cancel deals.");
  const current = await scopedDeal(actor, id);
  if (current.status === status) return current;
  if (status === "CANCELLED" && !reason) throw invalid("Write why the deal was cancelled.", { reason: ["Required"] });
  const result = await db.$transaction(async (tx) => {
    const deal = await tx.deal.update({
      where: { id },
      data: {
        status,
        closedAt: status === "PENDING_CONTRACT" ? null : new Date(),
        cancelReason: status === "CANCELLED" ? reason : null,
        ...(status === "CLOSED" ? { closingDate: new Date() } : {}),
      },
      select: dealCoreSelect,
    });
    let clientId = deal.clientId;
    if (status === "CLOSED") clientId = await closeInTx(tx, actor, deal);
    else if (status === "CANCELLED") await cancelInTx(tx, actor, deal, reason!);
    else await setPropertyStatus(tx, actor, deal, "RESERVED", `${deal.reference} reopened`);
    await logActivity(tx, {
      action: status === "PENDING_CONTRACT" ? "STATUS_CHANGED" : "CLOSED", entityType: "DEAL", entityId: id, entityLabel: deal.reference, userId: actor.id,
      dealId: id, propertyId: deal.propertyId, clientId, leadId: deal.leadId,
      description: `${deal.reference}: ${DEAL_STATUS_META[current.status].label} → ${DEAL_STATUS_META[status].label}${reason ? ` — ${reason}` : ""}`,
      meta: { from: current.status, to: status },
    });
    return { ...deal, clientId };
  });
  return result;
}

export async function deleteDeal(actor: Actor, id: string) {
  if (!can.deleteRecords(actor)) throw forbidden("Only managers can delete deals.");
  const deal = await db.deal.findUnique({ where: { id }, select: { reference: true, propertyId: true, clientId: true, _count: { select: { contracts: true } } } });
  if (!deal) throw notFound("Deal");
  if (deal._count.contracts) throw invalid("This deal has generated contracts. Cancel it instead of deleting it, so the paperwork stays on file.");
  await db.$transaction(async (tx) => {
    await tx.deal.delete({ where: { id } });
    await logActivity(tx, { action: "DELETED", entityType: "DEAL", entityId: id, entityLabel: deal.reference, description: `Deleted deal ${deal.reference}`, userId: actor.id, propertyId: deal.propertyId, clientId: deal.clientId });
  });
}
