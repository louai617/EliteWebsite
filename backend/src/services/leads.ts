import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { LeadSource, LeadStatus, ListingPurpose, Priority } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { can, canAssignTo, isManager, isStaff, scope, type Actor } from "@/lib/permissions";
import { DOCUMENT_KIND_META, LEAD_PIPELINE, LEAD_SOURCE_META, LEAD_STATUS_META } from "@/lib/constants";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { digitsOnly, like } from "@/lib/search";
import type { bulkReassignSchema, leadSchema, markLostSchema, markWonSchema, passDecisionSchema, passRequestSchema, updateLeadSchema } from "@/schemas/lead";
import { logActivity } from "./activity";
import { onLeadAssigned, onLeadStatusChanged } from "./automation";
import { assertActiveUser, assertCanAccess } from "./access";
import { openDealInTx } from "./deals";
import { convertLeadInTx } from "./lead-conversion";
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
              images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, thumbUrl: true } },
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
  if (!OPENING_STAGES.includes(data.status)) {
    throw invalid("New leads start in New, Contacted, Qualified or Viewing — move them forward from the lead's page.", { status: ["Choose an earlier stage"] });
  }
  await checkLeadRelations(actor, { agentId, interestedPropertyId });
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        ...data,
        agentId,
        assignedAt: agentId ? new Date() : null,
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

// ───────────────────────────── Stage rules ─────────────────────────────

/** Stages a lead may be created in (later stages need paperwork). */
const OPENING_STAGES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING_SCHEDULED"];
const WON_DOCUMENTS = ["BOOKING_FORM", "PROOF_OF_PAYMENT"] as const;

/**
 * The viewing step is passed once the signed viewing form (PDF / photo) is attached to the
 * lead, or a manager approved a pass request.
 */
export async function viewingGate(lead: { id: string }) {
  const [form, pass] = await Promise.all([
    db.document.findFirst({ where: { leadId: lead.id, kind: "VIEWING_FORM" }, select: { id: true } }),
    db.leadPassRequest.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, reason: true, createdAt: true, decisionNote: true, decidedAt: true, requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
    }),
  ]);
  return { viewingForm: Boolean(form), pass, passed: Boolean(form) || pass?.status === "APPROVED" };
}

export type ViewingGate = Awaited<ReturnType<typeof viewingGate>>;

const GATE_MESSAGE = "Attach the signed viewing form (PDF or photo) or request a pass before moving past the viewing stage.";

async function assertViewingPassed(lead: { id: string }) {
  if (!(await viewingGate(lead)).passed) throw invalid(GATE_MESSAGE, { gate: ["viewing"] });
}

/** Documents still missing to mark the lead Won (on the lead, or on its client's file). */
export async function missingWonDocuments(lead: { id: string; clientId: string | null }) {
  const docs = await db.document.findMany({
    where: { kind: { in: [...WON_DOCUMENTS] }, OR: [{ leadId: lead.id }, ...(lead.clientId ? [{ clientId: lead.clientId }] : [])] },
    select: { kind: true },
  });
  return WON_DOCUMENTS.filter((k) => !docs.some((d) => d.kind === k));
}

/** Rules every stage change goes through (board, menu, edit form, API). */
async function assertStageChange(lead: { id: string; status: LeadStatus }, to: LeadStatus) {
  if (lead.status === to) return;
  if (to === "WON") throw invalid("Use “Mark as won” to attach the booking form and the proof of payment.", { gate: ["won"] });
  if (to === "LOST") throw invalid("Use “Mark as lost” and write the reason.", { gate: ["lost"] });
  if (lead.status === "WON") {
    const deal = await db.deal.findFirst({ where: { leadId: lead.id, status: { in: ["PENDING_CONTRACT", "CLOSED"] } }, select: { reference: true } });
    if (deal) throw conflict(`This lead has deal ${deal.reference}. Cancel the deal to reopen the lead.`);
  }
  if (to === "NEGOTIATION") await assertViewingPassed(lead);
}

export async function updateLead(actor: Actor, input: z.output<typeof updateLeadSchema>) {
  const { id, interestedPropertyId, ...data } = input;
  const current = await scopedLead(actor, id);
  if (!isManager(actor) && data.agentId !== current.agentId) throw forbidden("Only managers can reassign leads.");
  await checkLeadRelations(actor, { agentId: data.agentId, interestedPropertyId });
  await assertStageChange(current, data.status);

  return db.$transaction(async (tx) => {
    const statusChanged = current.status !== data.status;
    const lead = await tx.lead.update({
      where: { id },
      data: {
        ...data,
        ...(statusChanged ? { statusChangedAt: new Date(), lostReason: null } : {}),
        ...(current.agentId !== data.agentId ? { assignedAt: data.agentId ? new Date() : null } : {}),
      },
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
  await assertStageChange(current, status);
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.update({ where: { id }, data: { status, statusChangedAt: new Date(), lostReason: null }, select: { id: true, fullName: true, status: true, agentId: true, clientId: true } });
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
    const lead = await tx.lead.update({ where: { id }, data: { agentId, assignedAt: agentId ? new Date() : null }, select: { id: true, fullName: true, agentId: true, status: true } });
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

/** Creates (or links) a client profile from a lead, carrying over requirements, interests and documents. */
export async function convertLeadToClient(actor: Actor, id: string) {
  await scopedLead(actor, id);
  return db.$transaction((tx) => convertLeadInTx(tx, id, actor.id));
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

// ───────────────────────────── Won / Lost ─────────────────────────────

/**
 * Won = booked. Requires the viewing step to be passed, the booking form and the proof of
 * payment. Opens the deal as "Pending contract" and reserves the property.
 */
export async function markLeadWon(actor: Actor, input: z.output<typeof markWonSchema>) {
  const lead = await scopedLead(actor, input.id);
  if (lead.status === "WON") throw conflict("This lead is already won.");
  await assertViewingPassed(lead);
  const missing = await missingWonDocuments(lead);
  if (missing.length) {
    throw invalid(`Attach the ${missing.map((k) => DOCUMENT_KIND_META[k].label.toLowerCase()).join(" and the ")} before marking the lead as won.`, { documents: [...missing] });
  }
  await assertCanAccess(actor, "property", input.propertyId);
  const property = await db.property.findUniqueOrThrow({ where: { id: input.propertyId }, select: { status: true, reference: true } });
  if (property.status === "SOLD" || property.status === "RENTED" || property.status === "OFF_MARKET") {
    throw invalid(`${property.reference} is not available (${property.status.toLowerCase().replace("_", " ")}).`, { propertyId: ["Not available"] });
  }
  const other = await db.deal.findFirst({ where: { propertyId: input.propertyId, status: "PENDING_CONTRACT", leadId: { not: lead.id } }, select: { reference: true } });
  if (other) throw conflict(`${property.reference} is already booked under ${other.reference}.`, { propertyId: ["Already booked"] });

  return db.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: { status: "WON", statusChangedAt: new Date(), lostReason: null },
      select: { id: true, fullName: true, status: true, agentId: true, clientId: true },
    });
    await tx.propertyInterest.upsert({
      where: { propertyId_leadId: { propertyId: input.propertyId, leadId: lead.id } },
      create: { propertyId: input.propertyId, leadId: lead.id },
      update: {},
    });
    await onLeadStatusChanged(tx, updated, lead.status, "WON", { id: actor.id, staff: isStaff(actor) });
    await logActivity(tx, {
      action: "STATUS_CHANGED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName, userId: actor.id, leadId: lead.id, clientId: lead.clientId, propertyId: input.propertyId,
      description: `Moved ${lead.fullName} from ${LEAD_STATUS_META[lead.status].label} to Won — booked ${property.reference}`, meta: { from: lead.status, to: "WON" },
    });
    const deal = await openDealInTx(tx, actor, { leadId: lead.id, clientId: lead.clientId, propertyId: input.propertyId, agentId: lead.agentId, amount: input.amount, notes: input.notes });
    // The booking paperwork travels with the deal.
    await tx.document.updateMany({
      where: { kind: { in: [...WON_DOCUMENTS] }, dealId: null, OR: [{ leadId: lead.id }, ...(lead.clientId ? [{ clientId: lead.clientId }] : [])] },
      data: { dealId: deal.id },
    });
    return { dealId: deal.id, reference: deal.reference };
  });
}

/** Lost needs a reason. Open follow-up tasks for the lead are cancelled. */
export async function markLeadLost(actor: Actor, input: z.output<typeof markLostSchema>) {
  const lead = await scopedLead(actor, input.id);
  if (lead.status === "LOST") throw conflict("This lead is already lost.");
  const deal = await db.deal.findFirst({ where: { leadId: lead.id, status: { in: ["PENDING_CONTRACT", "CLOSED"] } }, select: { reference: true } });
  if (deal) throw conflict(`This lead has deal ${deal.reference}. Ask a manager to cancel the deal instead.`);
  return db.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: { status: "LOST", statusChangedAt: new Date(), lostReason: input.reason },
      select: { id: true, fullName: true, status: true, agentId: true, clientId: true },
    });
    await onLeadStatusChanged(tx, updated, lead.status, "LOST", { id: actor.id, staff: isStaff(actor) });
    await tx.task.updateMany({ where: { leadId: lead.id, status: { in: ["TODO", "IN_PROGRESS"] }, type: { in: ["LEAD_RESPONSE", "LEAD_FOLLOW_UP", "LEAD_QUALIFICATION", "CALL"] } }, data: { status: "CANCELLED" } });
    await logActivity(tx, {
      action: "STATUS_CHANGED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName, userId: actor.id, leadId: lead.id, clientId: lead.clientId,
      description: `Moved ${lead.fullName} to Lost — ${input.reason}`, meta: { from: lead.status, to: "LOST", reason: input.reason },
    });
    return updated;
  });
}

// ───────────────────────────── Viewing pass ─────────────────────────────

/** Who receives escalations: the configured user, else the first active admin. */
export async function escalationUser(tx: Tx | typeof db = db) {
  const cfg = await tx.settings.findUnique({ where: { id: "default" }, select: { leadEscalationUserId: true } });
  if (cfg?.leadEscalationUserId) {
    const chosen = await tx.user.findFirst({ where: { id: cfg.leadEscalationUserId, isActive: true, role: { in: ["ADMIN", "MANAGER"] } }, select: { id: true, name: true } });
    if (chosen) return chosen;
  }
  return tx.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
}

/** Agents ask a manager; a manager's own request is approved straight away. */
export async function requestViewingPass(actor: Actor, input: z.output<typeof passRequestSchema>) {
  const lead = await scopedLead(actor, input.leadId);
  const gate = await viewingGate(lead);
  if (gate.passed) return { status: "APPROVED" as const, alreadyPassed: true };
  if (gate.pass?.status === "PENDING") throw conflict("A pass request is already waiting for a manager.");
  const manager = isManager(actor);
  return db.$transaction(async (tx) => {
    const request = await tx.leadPassRequest.create({
      data: {
        leadId: lead.id, reason: input.reason, requestedById: actor.id,
        ...(manager ? { status: "APPROVED", decidedById: actor.id, decidedAt: new Date(), decisionNote: "Approved by a manager" } : {}),
      },
      select: { id: true, status: true },
    });
    if (!manager) {
      const approver = await escalationUser(tx);
      await tx.task.create({
        data: {
          title: `Approve viewing pass for ${lead.fullName}`,
          description: `No viewing form. Reason given: “${input.reason}”. Approve or reject it on the lead's page.`,
          type: "LEAD_FOLLOW_UP", priority: "HIGH", dueDate: new Date(Date.now() + 4 * 3_600_000),
          leadId: lead.id, assigneeId: approver?.id ?? null, createdById: actor.id, autoKey: `viewing-pass:${request.id}`,
          events: { create: { type: "CREATED", actorId: actor.id, message: "Created automatically from a viewing pass request" } },
        },
      });
    }
    await logActivity(tx, {
      action: "UPDATED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName, userId: actor.id, leadId: lead.id,
      description: manager ? `Passed the viewing step for ${lead.fullName} without a form — ${input.reason}` : `Requested a viewing pass for ${lead.fullName} — ${input.reason}`,
    });
    return { status: request.status, alreadyPassed: false };
  });
}

export async function decideViewingPass(actor: Actor, input: z.output<typeof passDecisionSchema>) {
  if (!isManager(actor)) throw forbidden("Only managers can approve viewing passes.");
  const request = await db.leadPassRequest.findUnique({ where: { id: input.requestId }, select: { id: true, status: true, leadId: true, requestedById: true, lead: { select: { fullName: true } } } });
  if (!request) throw notFound("Pass request");
  if (request.status !== "PENDING") throw conflict("This request was already decided.");
  const status = input.approve ? "APPROVED" : "REJECTED";
  return db.$transaction(async (tx) => {
    await tx.leadPassRequest.update({ where: { id: request.id }, data: { status, decidedById: actor.id, decidedAt: new Date(), decisionNote: input.note } });
    await tx.task.updateMany({ where: { autoKey: `viewing-pass:${request.id}`, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "COMPLETED", completedAt: new Date() } });
    if (request.requestedById && request.requestedById !== actor.id) {
      await tx.task.create({
        data: {
          title: input.approve ? `Viewing pass approved — move ${request.lead.fullName} forward` : `Viewing pass rejected for ${request.lead.fullName}`,
          description: input.note ?? (input.approve ? "You can now move the lead past the viewing stage." : "Attach the signed viewing form to move the lead forward."),
          type: "LEAD_FOLLOW_UP", priority: "MEDIUM", dueDate: new Date(Date.now() + 24 * 3_600_000),
          leadId: request.leadId, assigneeId: request.requestedById, createdById: actor.id,
          events: { create: { type: "CREATED", actorId: actor.id, message: "Viewing pass decision" } },
        },
      });
    }
    await logActivity(tx, {
      action: "UPDATED", entityType: "LEAD", entityId: request.leadId, entityLabel: request.lead.fullName, userId: actor.id, leadId: request.leadId,
      description: `${input.approve ? "Approved" : "Rejected"} the viewing pass for ${request.lead.fullName}${input.note ? ` — ${input.note}` : ""}`,
    });
    return { status };
  });
}

// ───────────────────────────── Reassignment ─────────────────────────────

/**
 * The 24-hour rule (run by the scheduler): a lead still New with an agent after
 * `leadAutoReassignHours` moves to the admin's account. Managers' own leads are left alone.
 */
export async function reassignStaleLeads(now = new Date()) {
  const cfg = await db.settings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  if (!cfg.leadAutoReassignHours) return { moved: 0, to: null };
  const target = await escalationUser();
  if (!target) return { moved: 0, to: null };
  const cutoff = new Date(now.getTime() - cfg.leadAutoReassignHours * 3_600_000);
  const stale = await db.lead.findMany({
    where: {
      status: "NEW",
      agentId: { not: target.id },
      agent: { role: "AGENT" },
      OR: [{ assignedAt: { lte: cutoff } }, { assignedAt: null, createdAt: { lte: cutoff } }],
    },
    take: 200,
    select: { id: true, fullName: true, status: true, agent: { select: { name: true } } },
  });
  for (const lead of stale) {
    await db.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id: lead.id },
        data: { agentId: target.id, assignedAt: now, autoReassignedAt: now },
        select: { id: true, fullName: true, status: true, agentId: true },
      });
      await onLeadAssigned(tx, updated, null);
      await logActivity(tx, {
        action: "ASSIGNED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName, userId: null, leadId: lead.id,
        description: `${lead.fullName} moved from ${lead.agent?.name ?? "the agent"} to ${target.name} automatically — still New after ${cfg.leadAutoReassignHours} hours`,
        meta: { agentId: target.id, auto: true },
      });
    });
  }
  return { moved: stale.length, to: target.name };
}

/** Managers/admins move many leads at once (e.g. an agent is away or leaves). */
export async function bulkReassignLeads(actor: Actor, input: z.output<typeof bulkReassignSchema>) {
  if (!can.reassign(actor)) throw forbidden("Only managers can reassign leads.");
  await assertActiveUser(input.toAgentId);
  const from = input.fromAgentId === "none" ? null : input.fromAgentId;
  if (from === input.toAgentId) throw invalid("Choose a different agent to receive the leads.", { toAgentId: ["Same agent"] });
  const leads = await db.lead.findMany({
    where: { agentId: from, status: input.onlyNew ? "NEW" : { notIn: ["WON", "LOST"] } },
    take: 1000,
    select: { id: true, fullName: true },
  });
  if (!leads.length) return { moved: 0 };
  const [fromName, toName] = await Promise.all([from ? db.user.findUnique({ where: { id: from }, select: { name: true } }) : null, db.user.findUnique({ where: { id: input.toAgentId }, select: { name: true } })]);
  const now = new Date();
  await db.$transaction(async (tx) => {
    for (const lead of leads) {
      const updated = await tx.lead.update({ where: { id: lead.id }, data: { agentId: input.toAgentId, assignedAt: now }, select: { id: true, fullName: true, status: true, agentId: true } });
      await onLeadAssigned(tx, updated, actor.id);
      await logActivity(tx, {
        action: "ASSIGNED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName, userId: actor.id, leadId: lead.id,
        description: `Reassigned ${lead.fullName} from ${fromName?.name ?? "Unassigned"} to ${toName?.name}`, meta: { agentId: input.toAgentId, bulk: true },
      });
    }
  });
  return { moved: leads.length };
}
