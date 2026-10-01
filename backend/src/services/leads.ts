import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { CustomerType, LeadSource, LeadStatus, ListingPurpose, Priority } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { can, canAssignTo, isManager, isStaff, scope, type Actor } from "@/lib/permissions";
import { LEAD_PIPELINE, LEAD_SOURCE_META, LEAD_STATUS_META } from "@/lib/constants";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { digitsOnly, like } from "@/lib/search";
import type { leadSchema, updateLeadSchema } from "@/schemas/lead";
import { logActivity } from "./activity";
import { onLeadAssigned, onLeadStatusChanged } from "./automation";
import { assertActiveUser, assertCanAccess } from "./access";
import type { Tx } from "./types";

export const LEAD_SORTS = ["createdAt", "updatedAt", "fullName", "budgetMax", "statusChangedAt"] as const;

export interface LeadFilters {
  status?: LeadStatus;
  source?: LeadSource;
  priority?: Priority;
  purpose?: ListingPurpose;
  agentId?: string;
  from?: Date;
  to?: Date;
  budgetMin?: number;
  budgetMax?: number;
}

export function leadWhere(actor: Actor, q: string | undefined, f: LeadFilters): Prisma.LeadWhereInput {
  const digits = q ? digitsOnly(q) : "";
  return {
    AND: [
      scope.leads(actor),
      q ? { OR: [{ fullName: like(q) }, { email: like(q) }, { interestedArea: like(q) }, ...(digits.length >= 4 ? [{ phone: like(digits.slice(-4)) }] : [])] } : {},
      f.status ? { status: f.status } : {},
      f.source ? { source: f.source } : {},
      f.priority ? { priority: f.priority } : {},
      f.purpose ? { purpose: f.purpose } : {},
      f.agentId ? (f.agentId === "none" ? { agentId: null } : { agentId: f.agentId }) : {},
      f.from || f.to ? { createdAt: { gte: f.from, lt: f.to ? new Date(f.to.getTime() + 86_400_000) : undefined } } : {},
      // Budget overlap: the lead's range intersects the requested range.
      f.budgetMin !== undefined ? { OR: [{ budgetMax: { gte: f.budgetMin } }, { budgetMax: null }] } : {},
      f.budgetMax !== undefined ? { OR: [{ budgetMin: { lte: f.budgetMax } }, { budgetMin: null }] } : {},
    ],
  };
}

export const leadListSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  source: true,
  status: true,
  priority: true,
  purpose: true,
  leadType: true,
  interestedArea: true,
  budgetMin: true,
  budgetMax: true,
  bedrooms: true,
  createdAt: true,
  updatedAt: true,
  statusChangedAt: true,
  agentId: true,
  agent: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { viewings: true, tasks: true } },
} satisfies Prisma.LeadSelect;

export type LeadListItem = Prisma.LeadGetPayload<{ select: typeof leadListSelect }>;

function orderBy(params: ListParams<(typeof LEAD_SORTS)[number]>): Prisma.LeadOrderByWithRelationInput[] {
  return [{ [params.sort]: params.dir }, { createdAt: "desc" }];
}

export async function listLeads(actor: Actor, params: ListParams<(typeof LEAD_SORTS)[number]>, filters: LeadFilters) {
  const where = leadWhere(actor, params.q, filters);
  const [items, total] = await Promise.all([
    db.lead.findMany({ where, orderBy: orderBy(params), ...skipTake(params.page, params.pageSize), select: leadListSelect }),
    db.lead.count({ where }),
  ]);
  return paginate(items, total, params.page, params.pageSize);
}

const BOARD_COLUMN_LIMIT = 60;

/** Kanban data: each pipeline column with its true count and the most recent cards. */
export async function leadBoard(actor: Actor, q: string | undefined, filters: Omit<LeadFilters, "status">) {
  const base = leadWhere(actor, q, filters);
  const columns = await Promise.all(
    LEAD_PIPELINE.map(async (status) => {
      const where = { AND: [base, { status }] };
      const [items, total] = await Promise.all([
        db.lead.findMany({ where, orderBy: [{ statusChangedAt: "desc" }], take: BOARD_COLUMN_LIMIT, select: leadListSelect }),
        db.lead.count({ where }),
      ]);
      return { status, items, total };
    }),
  );
  return columns;
}

export async function getLead(actor: Actor, id: string) {
  const lead = await db.lead.findFirst({
    where: { id, ...scope.leads(actor) },
    include: {
      agent: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      client: { select: { id: true, fullName: true, clientType: true } },
      interests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          property: {
            select: {
              id: true, reference: true, title: true, area: true, status: true, price: true, currency: true, purpose: true, bedrooms: true,
              images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
            },
          },
        },
      },
      viewings: {
        orderBy: { startsAt: "desc" },
        select: { id: true, startsAt: true, endsAt: true, status: true, property: { select: { id: true, reference: true, title: true } }, agent: { select: { name: true } } },
      },
      deals: {
        orderBy: { createdAt: "desc" },
        select: { id: true, reference: true, type: true, status: true, amount: true, property: { select: { reference: true } } },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        select: { id: true, title: true, status: true, priority: true, dueDate: true, assignee: { select: { name: true } } },
      },
    },
  });
  return lead;
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLead>>>;

async function checkLeadRelations(actor: Actor, input: { agentId: string | null; interestedPropertyId?: string | null }) {
  if (!canAssignTo(actor, input.agentId)) throw forbidden("You can only assign leads to yourself.");
  await assertActiveUser(input.agentId);
  if (input.interestedPropertyId) await assertCanAccess(actor, "property", input.interestedPropertyId);
}

async function agentName(tx: Tx, id: string | null) {
  if (!id) return null;
  return (await tx.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
}

export async function createLead(actor: Actor, input: z.output<typeof leadSchema>) {
  const { interestedPropertyId, ...data } = input;
  const agentId = data.agentId ?? (isManager(actor) ? null : actor.id);
  await checkLeadRelations(actor, { agentId, interestedPropertyId });
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        ...data,
        agentId,
        interests: interestedPropertyId ? { create: [{ propertyId: interestedPropertyId }] } : undefined,
      },
      select: { id: true, fullName: true, source: true, agentId: true, status: true, clientId: true },
    });
    await onLeadAssigned(tx, lead, actor.id);
    if (lead.status !== "NEW") await onLeadStatusChanged(tx, lead, "NEW", lead.status, { id: actor.id, staff: isStaff(actor) });
    await logActivity(tx, {
      action: "CREATED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName,
      description: `New ${LEAD_SOURCE_META[lead.source].label} lead ${lead.fullName}`, userId: actor.id,
      leadId: lead.id, propertyId: interestedPropertyId,
    });
    if (lead.agentId && lead.agentId !== actor.id) {
      await logActivity(tx, {
        action: "ASSIGNED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName,
        description: `Assigned ${lead.fullName} to ${await agentName(tx, lead.agentId)}`, userId: actor.id, leadId: lead.id,
      });
    }
    return lead;
  });
}

async function scopedLead(actor: Actor, id: string) {
  const lead = await db.lead.findFirst({ where: { id, ...scope.leads(actor) }, select: { id: true, fullName: true, status: true, agentId: true, clientId: true } });
  if (!lead) throw notFound("Lead");
  return lead;
}

export async function updateLead(actor: Actor, input: z.output<typeof updateLeadSchema>) {
  const { id, interestedPropertyId, ...data } = input;
  const current = await scopedLead(actor, id);
  if (!isManager(actor) && data.agentId !== current.agentId) throw forbidden("Only managers can reassign leads.");
  await checkLeadRelations(actor, { agentId: data.agentId, interestedPropertyId });

  return db.$transaction(async (tx) => {
    const statusChanged = current.status !== data.status;
    const lead = await tx.lead.update({
      where: { id },
      data: { ...data, ...(statusChanged ? { statusChangedAt: new Date() } : {}) },
      select: { id: true, fullName: true, status: true, agentId: true, clientId: true },
    });
    if (statusChanged) await onLeadStatusChanged(tx, lead, current.status, lead.status, { id: actor.id, staff: isStaff(actor) });
    if (current.agentId !== lead.agentId) await onLeadAssigned(tx, lead, actor.id);
    if (interestedPropertyId) {
      await tx.propertyInterest.upsert({
        where: { propertyId_leadId: { propertyId: interestedPropertyId, leadId: id } },
        create: { propertyId: interestedPropertyId, leadId: id },
        update: {},
      });
    }
    if (statusChanged) {
      await logActivity(tx, {
        action: "STATUS_CHANGED", entityType: "LEAD", entityId: id, entityLabel: lead.fullName, userId: actor.id, leadId: id,
        description: `Moved ${lead.fullName} from ${LEAD_STATUS_META[current.status].label} to ${LEAD_STATUS_META[lead.status].label}`,
        meta: { from: current.status, to: lead.status },
      });
    }
    if (current.agentId !== lead.agentId) {
      const name = await agentName(tx, lead.agentId);
      await logActivity(tx, {
        action: "ASSIGNED", entityType: "LEAD", entityId: id, entityLabel: lead.fullName, userId: actor.id, leadId: id,
        description: name ? `Assigned ${lead.fullName} to ${name}` : `Unassigned ${lead.fullName}`,
      });
    }
    await logActivity(tx, { action: "UPDATED", entityType: "LEAD", entityId: id, entityLabel: lead.fullName, description: `Updated lead ${lead.fullName}`, userId: actor.id, leadId: id });
    return lead;
  });
}

export async function setLeadStatus(actor: Actor, id: string, status: LeadStatus) {
  const current = await scopedLead(actor, id);
  if (current.status === status) return current;
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.update({ where: { id }, data: { status, statusChangedAt: new Date() }, select: { id: true, fullName: true, status: true, agentId: true, clientId: true } });
    await onLeadStatusChanged(tx, lead, current.status, status, { id: actor.id, staff: isStaff(actor) });
    await logActivity(tx, {
      action: "STATUS_CHANGED", entityType: "LEAD", entityId: id, entityLabel: lead.fullName, userId: actor.id, leadId: id, clientId: lead.clientId,
      description: `Moved ${lead.fullName} from ${LEAD_STATUS_META[current.status].label} to ${LEAD_STATUS_META[status].label}`,
      meta: { from: current.status, to: status },
    });
    return lead;
  });
}

export async function assignLead(actor: Actor, id: string, agentId: string | null) {
  if (!can.reassign(actor) && agentId !== actor.id) throw forbidden("Only managers can reassign leads.");
  const current = await scopedLead(actor, id);
  await assertActiveUser(agentId);
  if (current.agentId === agentId) return current;
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.update({ where: { id }, data: { agentId }, select: { id: true, fullName: true, agentId: true, status: true } });
    await onLeadAssigned(tx, lead, actor.id);
    const name = await agentName(tx, agentId);
    await logActivity(tx, {
      action: "ASSIGNED", entityType: "LEAD", entityId: id, entityLabel: lead.fullName, userId: actor.id, leadId: id,
      description: name ? `Assigned ${lead.fullName} to ${name}` : `Unassigned ${lead.fullName}`, meta: { agentId },
    });
    return lead;
  });
}

export async function deleteLead(actor: Actor, id: string) {
  if (!can.deleteRecords(actor)) throw forbidden("Only managers can delete leads.");
  const lead = await db.lead.findUnique({ where: { id }, select: { fullName: true } });
  if (!lead) throw notFound("Lead");
  await db.$transaction(async (tx) => {
    await tx.lead.delete({ where: { id } });
    await logActivity(tx, { action: "DELETED", entityType: "LEAD", entityId: id, entityLabel: lead.fullName, description: `Deleted lead ${lead.fullName}`, userId: actor.id });
  });
}

/** Creates (or links) a client profile from a lead, carrying over requirements and interests. */
export async function convertLeadToClient(actor: Actor, id: string) {
  const lead = await db.lead.findFirst({ where: { id, ...scope.leads(actor) }, include: { interests: { select: { propertyId: true } } } });
  if (!lead) throw notFound("Lead");
  if (lead.clientId) return { clientId: lead.clientId, created: false };

  const clientType: CustomerType = lead.leadType ?? (lead.purpose === "RENT" ? "TENANT" : "BUYER");
  return db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email,
        nationality: lead.nationality,
        clientType,
        budgetMin: lead.budgetMin,
        budgetMax: lead.budgetMax,
        requirements: [
          lead.purpose && `Looking to ${lead.purpose === "RENT" ? "rent" : "buy"}`,
          lead.bedrooms != null && `${lead.bedrooms === 0 ? "Studio" : `${lead.bedrooms} bedrooms`}`,
          lead.interestedArea && `in ${lead.interestedArea}`,
        ].filter(Boolean).join(", ") || null,
        notes: lead.notes,
        agentId: lead.agentId,
        interests: { create: lead.interests.map((i) => ({ propertyId: i.propertyId })) },
      },
      select: { id: true, fullName: true },
    });
    await tx.lead.update({ where: { id }, data: { clientId: client.id } });
    await logActivity(tx, {
      action: "CONVERTED", entityType: "LEAD", entityId: id, entityLabel: lead.fullName,
      description: `Converted lead ${lead.fullName} into a client`, userId: actor.id, leadId: id, clientId: client.id,
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "CLIENT", entityId: client.id, entityLabel: client.fullName,
      description: `Added client ${client.fullName} from a lead`, userId: actor.id, clientId: client.id, leadId: id,
    });
    return { clientId: client.id, created: true };
  });
}

export async function addLeadInterest(actor: Actor, leadId: string, propertyId: string) {
  await scopedLead(actor, leadId);
  await assertCanAccess(actor, "property", propertyId);
  await db.propertyInterest.upsert({
    where: { propertyId_leadId: { propertyId, leadId } },
    create: { propertyId, leadId },
    update: {},
  });
}

export async function removeLeadInterest(actor: Actor, leadId: string, propertyId: string) {
  await scopedLead(actor, leadId);
  await db.propertyInterest.deleteMany({ where: { leadId, propertyId } });
}
