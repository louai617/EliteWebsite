import "server-only";
import type { LeadStatus } from "@/generated/prisma/enums";
import { completeTasks, recordWorkActivity } from "./work-activities";
import type { Tx } from "./types";

/**
 * CRM → task tracker → daily report wiring. Every hook runs inside the caller's transaction,
 * is idempotent (dedupe/auto keys) and only touches operational data, so the business
 * mutation succeeds or fails as one unit.
 *
 *   Lead assigned        → "Respond to lead" task for the agent (due within the SLA)
 *   Lead contacted       → LEAD_RESPONSE activity + response task completed
 *   Lead qualified       → LEAD_QUALIFICATION activity
 *   Lead won / deal won  → CONVERSION activity (once per lead, or per deal without a lead)
 *   Viewing completed    → VIEWING activity + linked viewing tasks completed
 *   Listing created      → NEW_LISTING activity
 */

async function settings(tx: Tx) {
  return (await tx.settings.findUnique({ where: { id: "default" }, select: { autoLeadResponseTasks: true, leadResponseSlaMinutes: true } })) ?? {
    autoLeadResponseTasks: true,
    leadResponseSlaMinutes: 60,
  };
}

/** A lead was created with, or (re)assigned to, an agent: create the response task. */
export async function onLeadAssigned(tx: Tx, lead: { id: string; fullName: string; status: LeadStatus; agentId: string | null }, actorId: string | null) {
  if (!lead.agentId || lead.status !== "NEW") return;
  const cfg = await settings(tx);
  if (!cfg.autoLeadResponseTasks) return;
  const autoKey = `lead-response:${lead.id}:${lead.agentId}`;
  if (await tx.task.findUnique({ where: { autoKey }, select: { id: true } })) return;
  // Hand over: an earlier agent's open response task for this lead is cancelled.
  const previous = await tx.task.findMany({ where: { leadId: lead.id, type: "LEAD_RESPONSE", status: { in: ["TODO", "IN_PROGRESS"] }, assigneeId: { not: lead.agentId } }, select: { id: true, status: true } });
  for (const t of previous) {
    await tx.task.update({ where: { id: t.id }, data: { status: "CANCELLED" } });
    await tx.taskEvent.create({ data: { taskId: t.id, actorId, type: "STATUS_CHANGED", fromValue: t.status, toValue: "CANCELLED", message: "Lead was reassigned to another agent" } });
  }
  await tx.task.create({
    data: {
      title: `Respond to new lead ${lead.fullName}`,
      description: `First contact within ${cfg.leadResponseSlaMinutes} minutes. Completes automatically when the lead is moved out of "New" or a lead response is logged.`,
      type: "LEAD_RESPONSE",
      priority: "HIGH",
      dueDate: new Date(Date.now() + cfg.leadResponseSlaMinutes * 60_000),
      leadId: lead.id,
      assigneeId: lead.agentId,
      assignedById: actorId,
      createdById: actorId,
      autoKey,
      events: { create: [{ type: "CREATED", actorId, message: "Created automatically for a newly assigned lead" }] },
    },
  });
}

/** A lead changed status: record the matching work and close the response task. */
export async function onLeadStatusChanged(tx: Tx, lead: { id: string; agentId: string | null; clientId?: string | null }, from: LeadStatus, to: LeadStatus, actor: { id: string; staff: boolean }) {
  const agentId = lead.agentId ?? (actor.staff ? actor.id : null);
  if (!agentId) return;
  if (from === "NEW" && to !== "NEW" && to !== "LOST") {
    await recordWorkActivity(tx, { type: "LEAD_RESPONSE", agentId, source: "SYSTEM", loggedById: actor.id, leadId: lead.id, dedupeKey: `lead-response:${lead.id}`, outcome: "First contact" });
    await completeTasks(tx, { leadId: lead.id, type: "LEAD_RESPONSE" }, "Completed automatically: the lead was contacted", actor.id);
  }
  if (to === "QUALIFIED") {
    await recordWorkActivity(tx, { type: "LEAD_QUALIFICATION", agentId, source: "SYSTEM", loggedById: actor.id, leadId: lead.id, dedupeKey: `lead-qualified:${lead.id}` });
    await completeTasks(tx, { leadId: lead.id, type: "LEAD_QUALIFICATION", assigneeId: agentId }, "Completed automatically: the lead was qualified", actor.id);
  }
  if (to === "WON") {
    await recordWorkActivity(tx, { type: "CONVERSION", agentId, source: "SYSTEM", loggedById: actor.id, leadId: lead.id, clientId: lead.clientId ?? null, dedupeKey: `conversion:lead:${lead.id}` });
  }
}


/** A viewing was scheduled: the agent gets a "Conduct viewing" task due at the start time. */
export async function onViewingScheduled(tx: Tx, viewing: { id: string; agentId: string | null; startsAt: Date; propertyId: string; leadId: string | null; clientId: string | null; label: string }, actorId: string) {
  if (!viewing.agentId) return;
  const autoKey = `viewing:${viewing.id}`;
  if (await tx.task.findUnique({ where: { autoKey }, select: { id: true } })) return;
  await tx.task.create({
    data: {
      title: `Conduct viewing: ${viewing.label}`,
      type: "VIEWING",
      priority: "HIGH",
      dueDate: viewing.startsAt,
      viewingId: viewing.id,
      propertyId: viewing.propertyId,
      leadId: viewing.leadId,
      clientId: viewing.clientId,
      assigneeId: viewing.agentId,
      assignedById: actorId,
      createdById: actorId,
      autoKey,
      events: { create: [{ type: "CREATED", actorId, message: "Created automatically when the viewing was scheduled" }] },
    },
  });
}

/** A viewing was cancelled or the client did not show: its open tasks are cancelled. */
export async function onViewingCancelled(tx: Tx, viewingId: string, reason: string, actorId: string) {
  const tasks = await tx.task.findMany({ where: { viewingId, status: { in: ["TODO", "IN_PROGRESS"] } }, select: { id: true, status: true } });
  for (const t of tasks) {
    await tx.task.update({ where: { id: t.id }, data: { status: "CANCELLED" } });
    await tx.taskEvent.create({ data: { taskId: t.id, actorId, type: "STATUS_CHANGED", fromValue: t.status, toValue: "CANCELLED", message: reason } });
  }
}

export async function onViewingCompleted(tx: Tx, viewing: { id: string; agentId: string | null; propertyId: string; leadId: string | null; clientId: string | null }, actor: { id: string; staff: boolean }) {
  const agentId = viewing.agentId ?? (actor.staff ? actor.id : null);
  if (!agentId) return;
  await recordWorkActivity(tx, {
    type: "VIEWING", agentId, source: "SYSTEM", loggedById: actor.id, viewingId: viewing.id, propertyId: viewing.propertyId,
    leadId: viewing.leadId, clientId: viewing.clientId, dedupeKey: `viewing-completed:${viewing.id}`,
  });
  await completeTasks(tx, { viewingId: viewing.id }, "Completed automatically: the viewing took place", actor.id);
}

export async function onDealWon(tx: Tx, deal: { id: string; agentId: string | null; leadId: string | null; clientId: string; propertyId: string }, actor: { id: string; staff: boolean }) {
  const agentId = deal.agentId ?? (actor.staff ? actor.id : null);
  if (!agentId) return;
  await recordWorkActivity(tx, {
    type: "CONVERSION", agentId, source: "SYSTEM", loggedById: actor.id, dealId: deal.id, leadId: deal.leadId, clientId: deal.clientId, propertyId: deal.propertyId,
    // Same key as the lead's "Won" event, so a won deal + won lead count as one conversion.
    dedupeKey: deal.leadId ? `conversion:lead:${deal.leadId}` : `conversion:deal:${deal.id}`,
  });
}

export async function onPropertyCreated(tx: Tx, property: { id: string; agentId: string | null }, actor: { id: string; staff: boolean }) {
  const agentId = property.agentId ?? (actor.staff ? actor.id : null);
  if (!agentId) return;
  await recordWorkActivity(tx, { type: "NEW_LISTING", agentId, source: "SYSTEM", loggedById: actor.id, propertyId: property.id, dedupeKey: `new-listing:${property.id}` });
  await completeTasks(tx, { propertyId: property.id, type: "NEW_LISTING", assigneeId: agentId }, "Completed automatically: the listing was created", actor.id);
}

