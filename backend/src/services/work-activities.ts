import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { WorkActivitySource, WorkActivityType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { businessDate, type BusinessDate } from "@/lib/business-day";
import { WORK_ACTIVITY_META } from "@/lib/constants";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { canEditProperty, hasPermission, isManager, scope, type Actor } from "@/lib/permissions";
import { paginate, skipTake } from "@/lib/list-params";
import type { propertyPostingSchema, workActivitySchema } from "@/schemas/work-activity";
import { logActivity } from "./activity";
import { assertActiveUser, assertRelated } from "./access";
import type { Tx } from "./types";

/**
 * Agent work activities (calls, lead responses, postings, viewings, conversions…).
 *
 * This append-only log is the single source of truth for daily reports and performance
 * scores. Activities come from three places:
 *   MANUAL  an agent (or a manager on their behalf) logs work, e.g. "Called Ahmed"
 *   TASK    a task of a real-estate type is completed (e.g. "Post property" → PROPERTY_POST)
 *   SYSTEM  CRM events (lead contacted, viewing completed, deal won, listing created)
 * System/task activities carry a `dedupeKey` so the same event is never counted twice.
 */

export interface RecordActivityInput {
  type: WorkActivityType;
  agentId: string;
  source: WorkActivitySource;
  occurredAt?: Date;
  loggedById?: string | null;
  outcome?: string | null;
  notes?: string | null;
  durationMin?: number | null;
  dedupeKey?: string | null;
  taskId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  propertyId?: string | null;
  viewingId?: string | null;
  dealId?: string | null;
}

/** Records one activity (idempotent when `dedupeKey` is set) and updates daily-task progress. */
export async function recordWorkActivity(tx: Tx, input: RecordActivityInput) {
  if (input.dedupeKey) {
    const existing = await tx.agentActivity.findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
    if (existing) return null;
  }
  const occurredAt = input.occurredAt ?? new Date();
  const date = businessDate(occurredAt);
  const activity = await tx.agentActivity.create({
    data: { ...input, occurredAt, businessDate: date },
    select: { id: true, type: true, agentId: true, businessDate: true, propertyId: true },
  });
  if ((activity.type === "PROPERTY_POST" || activity.type === "PROPERTY_REPOST") && activity.propertyId) {
    await tx.property.update({ where: { id: activity.propertyId }, data: { lastPostedAt: occurredAt } });
  }
  await progressDailyTasks(tx, activity.agentId, date, activity.type);
  return activity;
}

/**
 * Counter-style daily tasks ("Make 20 calls") progress from activities: the task moves to
 * In progress on the first matching activity and completes itself when the target is met.
 */
export async function progressDailyTasks(tx: Tx, agentId: string, date: BusinessDate, type: WorkActivityType) {
  const tasks = await tx.task.findMany({
    where: { assigneeId: agentId, dailyDate: date, status: { in: ["TODO", "IN_PROGRESS"] }, template: { activityType: type } },
    select: { id: true, status: true, targetCount: true, startedAt: true },
  });
  if (!tasks.length) return;
  const count = await tx.agentActivity.count({ where: { agentId, businessDate: date, type } });
  for (const task of tasks) {
    const target = task.targetCount ?? 1;
    if (count >= target) {
      await tx.task.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: new Date(), startedAt: task.startedAt ?? new Date() } });
      await tx.taskEvent.create({
        data: { taskId: task.id, type: "STATUS_CHANGED", fromValue: task.status, toValue: "COMPLETED", message: `Target reached: ${count}/${target} ${WORK_ACTIVITY_META[type].label.toLowerCase()}` },
      });
    } else if (task.status === "TODO" && count > 0) {
      await tx.task.update({ where: { id: task.id }, data: { status: "IN_PROGRESS", startedAt: task.startedAt ?? new Date() } });
      await tx.taskEvent.create({ data: { taskId: task.id, type: "STATUS_CHANGED", fromValue: "TODO", toValue: "IN_PROGRESS", message: `Started: ${count}/${target}` } });
    }
  }
}

/** Completes every open task matching `where`, with a history entry explaining why. */
export async function completeTasks(tx: Tx, where: Prisma.TaskWhereInput, message: string, actorId: string | null) {
  const tasks = await tx.task.findMany({ where: { AND: [where, { status: { in: ["TODO", "IN_PROGRESS"] } }] }, select: { id: true, status: true, startedAt: true } });
  for (const task of tasks) {
    const now = new Date();
    await tx.task.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: now, startedAt: task.startedAt ?? now } });
    await tx.taskEvent.create({ data: { taskId: task.id, actorId, type: "STATUS_CHANGED", fromValue: task.status, toValue: "COMPLETED", message } });
  }
  return tasks.length;
}

/** Daily-task progress for display: { taskId → count so far }. */
export async function dailyProgress(tasks: { id: string; assigneeId: string | null; dailyDate: string | null; template: { activityType: WorkActivityType | null } | null }[]) {
  const keys = new Map<string, { agentId: string; date: string; type: WorkActivityType }>();
  for (const t of tasks) {
    if (t.assigneeId && t.dailyDate && t.template?.activityType) keys.set(`${t.assigneeId}|${t.dailyDate}|${t.template.activityType}`, { agentId: t.assigneeId, date: t.dailyDate, type: t.template.activityType });
  }
  if (!keys.size) return new Map<string, number>();
  const rows = await db.agentActivity.groupBy({
    by: ["agentId", "businessDate", "type"],
    where: { OR: [...keys.values()].map((k) => ({ agentId: k.agentId, businessDate: k.date, type: k.type })) },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((r) => [`${r.agentId}|${r.businessDate}|${r.type}`, r._count._all]));
  const out = new Map<string, number>();
  for (const t of tasks) {
    if (t.assigneeId && t.dailyDate && t.template?.activityType) out.set(t.id, counts.get(`${t.assigneeId}|${t.dailyDate}|${t.template.activityType}`) ?? 0);
  }
  return out;
}

const LINK_LABEL = { lead: "lead", client: "client", property: "property", viewing: "viewing", deal: "deal" } as const;

/** Manual logging from the CRM ("Log activity"). Managers may log on behalf of an agent. */
export async function logWorkActivity(actor: Actor, input: z.output<typeof workActivitySchema>) {
  const agentId = input.agentId ?? actor.id;
  if (agentId !== actor.id && !hasPermission(actor, "workActivities.logForOthers")) throw forbidden("You can only log your own activities.");
  if (input.occurredAt && input.occurredAt.getTime() > Date.now() + 5 * 60_000) throw invalid("Activities can't be logged in the future.", { occurredAt: ["In the future"] });
  if (input.occurredAt && businessDate(input.occurredAt) < businessDate() && !isManager(actor)) {
    throw invalid("Only today's activities can be logged — past days are already reported.", { occurredAt: ["Before today"] });
  }
  await assertActiveUser(agentId);
  await assertRelated(actor, { lead: input.leadId, client: input.clientId, property: input.propertyId, viewing: input.viewingId, deal: input.dealId });
  if (input.taskId) {
    const task = await db.task.findFirst({ where: { id: input.taskId, ...scope.tasks(actor) }, select: { id: true } });
    if (!task) throw notFound("Task");
  }

  // A lead's first response counts once ("leads answered"); later contact is a follow-up.
  const firstResponse = input.type === "LEAD_RESPONSE" && input.leadId ? `lead-response:${input.leadId}` : null;
  if (firstResponse && (await db.agentActivity.findUnique({ where: { dedupeKey: firstResponse }, select: { id: true } }))) {
    throw invalid("This lead's first response is already recorded — log a follow-up instead.", { type: ["Already answered"] });
  }

  return db.$transaction(async (tx) => {
    const activity = await recordWorkActivity(tx, { ...input, occurredAt: input.occurredAt ?? undefined, agentId, source: "MANUAL", loggedById: actor.id, dedupeKey: firstResponse });
    if (firstResponse && input.leadId) {
      await completeTasks(tx, { leadId: input.leadId, type: "LEAD_RESPONSE" }, "Completed: a lead response was logged", actor.id);
      const lead = await tx.lead.findUnique({ where: { id: input.leadId }, select: { status: true } });
      if (lead?.status === "NEW") await tx.lead.update({ where: { id: input.leadId }, data: { status: "CONTACTED", statusChangedAt: new Date() } });
    }
    if (input.taskId) {
      await completeTasks(tx, { id: input.taskId }, `Completed by logging: ${WORK_ACTIVITY_META[input.type].label.toLowerCase()}`, actor.id);
    }
    const links = { leadId: input.leadId, clientId: input.clientId, propertyId: input.propertyId, viewingId: input.viewingId, dealId: input.dealId, taskId: input.taskId };
    const target = (Object.keys(LINK_LABEL) as (keyof typeof LINK_LABEL)[]).find((k) => links[`${k}Id` as keyof typeof links]);
    await logActivity(tx, {
      action: "WORK_LOGGED", entityType: "USER", entityId: agentId, entityLabel: WORK_ACTIVITY_META[input.type].label,
      description: `Logged ${WORK_ACTIVITY_META[input.type].label.toLowerCase()}${target ? ` on a ${LINK_LABEL[target]}` : ""}${input.outcome ? ` — ${input.outcome}` : ""}`,
      userId: actor.id, ...links,
    });
    return activity!;
  });
}

/** Mistakes can be removed while the day is still open; finalized days are immutable. */
export async function deleteWorkActivity(actor: Actor, id: string) {
  const activity = await db.agentActivity.findFirst({ where: { id, ...scope.workActivities(actor) }, select: { id: true, agentId: true, source: true, businessDate: true, loggedById: true } });
  if (!activity) throw notFound("Activity");
  if (activity.source !== "MANUAL") throw forbidden("Automatically recorded activities can't be removed.");
  if (activity.businessDate !== businessDate()) throw forbidden("Only today's activities can be removed — past days are final.");
  if (!isManager(actor) && activity.loggedById !== actor.id) throw forbidden();
  await db.agentActivity.delete({ where: { id } });
}

export interface WorkActivityFilters {
  agentId?: string;
  type?: WorkActivityType;
  from?: BusinessDate;
  to?: BusinessDate;
  leadId?: string;
  propertyId?: string;
}

export const workActivitySelect = {
  id: true,
  type: true,
  source: true,
  occurredAt: true,
  businessDate: true,
  outcome: true,
  notes: true,
  durationMin: true,
  agent: { select: { id: true, name: true, avatarUrl: true } },
  loggedBy: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
  lead: { select: { id: true, fullName: true } },
  client: { select: { id: true, fullName: true } },
  property: { select: { id: true, reference: true } },
  viewing: { select: { id: true, startsAt: true } },
  deal: { select: { id: true, reference: true } },
} satisfies Prisma.AgentActivitySelect;

export type WorkActivityItem = Prisma.AgentActivityGetPayload<{ select: typeof workActivitySelect }>;

export async function listWorkActivities(actor: Actor, filters: WorkActivityFilters, page = 1, pageSize = 50) {
  const where: Prisma.AgentActivityWhereInput = {
    AND: [
      scope.workActivities(actor),
      filters.agentId ? { agentId: filters.agentId } : {},
      filters.type ? { type: filters.type } : {},
      filters.from || filters.to ? { businessDate: { gte: filters.from, lte: filters.to } } : {},
      filters.leadId ? { leadId: filters.leadId } : {},
      filters.propertyId ? { propertyId: filters.propertyId } : {},
    ],
  };
  const [items, total] = await Promise.all([
    db.agentActivity.findMany({ where, orderBy: { occurredAt: "desc" }, ...skipTake(page, pageSize), select: workActivitySelect }),
    db.agentActivity.count({ where }),
  ]);
  return paginate(items, total, page, pageSize);
}

/** Activity counts per type for an agent over a business-date range. */
export async function activityCounts(agentId: string, from: BusinessDate, to: BusinessDate) {
  const rows = await db.agentActivity.groupBy({ by: ["type"], where: { agentId, businessDate: { gte: from, lte: to } }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.type, r._count._all])) as Partial<Record<WorkActivityType, number>>;
}


const POSTING_TASK = { PROPERTY_POST: "PROPERTY_POSTING", PROPERTY_REPOST: "PROPERTY_REPOST" } as const;

/** "Mark posted / reposted" on a listing: records the activity and closes matching tasks. */
export async function recordPropertyPosting(actor: Actor, input: z.output<typeof propertyPostingSchema>) {
  const property = await db.property.findUnique({ where: { id: input.propertyId }, select: { id: true, reference: true, title: true, agentId: true } });
  if (!property) throw notFound("Property");
  if (!canEditProperty(actor, property)) throw forbidden("Only the listing agent or a manager can record postings.");
  return db.$transaction(async (tx) => {
    const activity = await recordWorkActivity(tx, { type: input.kind, agentId: actor.id, source: "MANUAL", loggedById: actor.id, propertyId: property.id, outcome: input.outcome });
    await completeTasks(tx, { propertyId: property.id, type: POSTING_TASK[input.kind], assigneeId: actor.id }, `Completed: ${WORK_ACTIVITY_META[input.kind].label.toLowerCase()}`, actor.id);
    await logActivity(tx, {
      action: "WORK_LOGGED", entityType: "PROPERTY", entityId: property.id, entityLabel: `${property.reference} · ${property.title}`,
      description: `${input.kind === "PROPERTY_POST" ? "Posted" : "Reposted"} ${property.reference}${input.outcome ? ` on ${input.outcome}` : ""}`,
      userId: actor.id, propertyId: property.id,
    });
    return activity!;
  });
}
