import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Priority, TaskStatus, TaskType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { canAssignTo, hasPermission, isManager, isStaff, scope, type Actor } from "@/lib/permissions";
import { PRIORITY_META, TASK_STATUS_META, TASK_TYPE_ACTIVITY } from "@/lib/constants";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { like } from "@/lib/search";
import { businessDate, dayRange, shiftDate, weekday, WEEK_START_DAY } from "@/lib/business-day";
import { formatDateTime, zonedDayStart } from "@/lib/format";
import type { reassignTaskSchema, taskSchema, updateTaskSchema } from "@/schemas/task";
import { logActivity } from "./activity";
import { assertActiveUser, assertRelated } from "./access";
import { recordWorkActivity } from "./work-activities";
import type { Tx } from "./types";

/**
 * Task tracker. Tasks are linked to real CRM records (lead, client, property, deal, viewing),
 * carry a real-estate `type`, and keep an immutable history (TaskEvent): who created and
 * assigned them, every status/priority/due change, reassignments and notes.
 *
 * Completing a typed task records the matching agent activity (e.g. "Post property" →
 * PROPERTY_POST), which feeds the daily report and the performance score.
 */

export const TASK_SORTS = ["dueDate", "createdAt", "updatedAt", "title", "priority"] as const;
export type DueFilter = "overdue" | "today" | "week" | "none";
const OPEN: TaskStatus[] = ["TODO", "IN_PROGRESS"];

export interface TaskFilters {
  status?: TaskStatus;
  priority?: Priority;
  type?: TaskType;
  assigneeId?: string;
  /** Only tasks assigned to the actor ("My tasks"). */
  mine?: boolean;
  due?: DueFilter;
  open?: boolean;
  /** Daily operational tasks of this business date. */
  dailyDate?: string;
  leadId?: string;
  clientId?: string;
  propertyId?: string;
  dealId?: string;
  viewingId?: string;
}

/** Doha-time day window. */
function dayBounds(offsetDays = 0) {
  return { start: zonedDayStart(offsetDays), end: zonedDayStart(offsetDays + 1) };
}

function dueWhere(due: DueFilter | undefined): Prisma.TaskWhereInput {
  const today = dayBounds();
  switch (due) {
    case "overdue":
      return { dueDate: { lt: new Date() }, status: { in: OPEN } };
    case "today":
      return { dueDate: { gte: today.start, lt: today.end } };
    case "week":
      return { dueDate: { gte: today.start, lt: dayBounds(7).start } };
    case "none":
      return { dueDate: null };
    default:
      return {};
  }
}

export const taskSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  status: true,
  priority: true,
  dueDate: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  clientVisible: true,
  dailyDate: true,
  targetCount: true,
  assigneeId: true,
  createdById: true,
  leadId: true,
  clientId: true,
  propertyId: true,
  dealId: true,
  viewingId: true,
  template: { select: { activityType: true } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  createdBy: { select: { id: true, name: true } },
  assignedBy: { select: { id: true, name: true } },
  lead: { select: { id: true, fullName: true } },
  client: { select: { id: true, fullName: true } },
  property: { select: { id: true, reference: true } },
  deal: { select: { id: true, reference: true } },
  viewing: { select: { id: true, startsAt: true } },
} satisfies Prisma.TaskSelect;

export type TaskItem = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

export function taskWhere(actor: Actor, q: string | undefined, filters: TaskFilters): Prisma.TaskWhereInput {
  return {
    AND: [
      scope.tasks(actor),
      q ? { OR: [{ title: like(q) }, { description: like(q) }, { lead: { fullName: like(q) } }, { client: { fullName: like(q) } }, { property: { reference: like(q) } }] } : {},
      filters.mine ? { assigneeId: actor.id } : {},
      filters.status ? { status: filters.status } : {},
      filters.open ? { status: { in: OPEN } } : {},
      filters.priority ? { priority: filters.priority } : {},
      filters.type ? { type: filters.type } : {},
      filters.assigneeId ? (filters.assigneeId === "none" ? { assigneeId: null } : { assigneeId: filters.assigneeId }) : {},
      dueWhere(filters.due),
      filters.dailyDate ? { dailyDate: filters.dailyDate } : {},
      filters.leadId ? { leadId: filters.leadId } : {},
      filters.clientId ? { clientId: filters.clientId } : {},
      filters.propertyId ? { propertyId: filters.propertyId } : {},
      filters.dealId ? { dealId: filters.dealId } : {},
      filters.viewingId ? { viewingId: filters.viewingId } : {},
    ],
  };
}

export function countTasks(actor: Actor, q: string | undefined, filters: TaskFilters) {
  return db.task.count({ where: taskWhere(actor, q, filters) });
}

const PRIORITY_ORDER: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export async function listTasks(actor: Actor, params: ListParams<(typeof TASK_SORTS)[number]>, filters: TaskFilters) {
  const where = taskWhere(actor, params.q, filters);
  if (params.sort === "priority") {
    // Enum order isn't urgency order in SQL, so sort a bounded set in memory.
    const all = await db.task.findMany({ where, select: taskSelect, take: 2000, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }] });
    all.sort((a, b) => (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * (params.dir === "asc" ? -1 : 1));
    const start = (params.page - 1) * params.pageSize;
    return paginate(all.slice(start, start + params.pageSize), all.length, params.page, params.pageSize);
  }
  // Nulls last for due-date ordering so undated tasks don't crowd the top.
  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    params.sort === "dueDate" ? [{ dueDate: { sort: params.dir, nulls: "last" } }, { createdAt: "desc" }] : [{ [params.sort]: params.dir }, { id: "asc" }];
  const [items, total] = await Promise.all([
    db.task.findMany({ where, orderBy, ...skipTake(params.page, params.pageSize), select: taskSelect }),
    db.task.count({ where }),
  ]);
  return paginate(items, total, params.page, params.pageSize);
}

/** Open tasks that are overdue or due today (team-wide for managers) for the dashboard. */
export async function focusTasks(actor: Actor, take = 8) {
  const { end } = dayBounds();
  return db.task.findMany({
    where: { AND: [scope.tasks(actor), { status: { in: OPEN }, dueDate: { lt: end } }] },
    orderBy: [{ dueDate: "asc" }],
    take,
    select: taskSelect,
  });
}

/** Full task with history, for the task page. */
export async function getTask(actor: Actor, id: string) {
  const task = await db.task.findFirst({
    where: { id, ...scope.tasks(actor) },
    select: {
      ...taskSelect,
      events: { orderBy: { createdAt: "desc" }, select: { id: true, type: true, fromValue: true, toValue: true, message: true, createdAt: true, actor: { select: { id: true, name: true, avatarUrl: true } } } },
      workActivities: { orderBy: { occurredAt: "desc" }, select: { id: true, type: true, occurredAt: true, agent: { select: { name: true } } } },
    },
  });
  if (!task) return null;
  return { ...task, canEdit: canEditDetails(actor, task), canReassign: hasPermission(actor, "tasks.assign"), canDelete: canDelete(actor, task) };
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTask>>>;

/** Details (title, due, links…) belong to whoever set the task; assignees change status and add notes. */
const canEditDetails = (actor: Actor, task: { createdById: string | null }) => isManager(actor) || task.createdById === actor.id;
const canDelete = (actor: Actor, task: { createdById: string | null }) => isManager(actor) || task.createdById === actor.id;

async function checkTask(actor: Actor, input: { assigneeId: string | null; leadId: string | null; clientId: string | null; propertyId: string | null; dealId: string | null; viewingId: string | null }) {
  if (!canAssignTo(actor, input.assigneeId)) throw forbidden("Only managers can assign tasks to other people.");
  await assertActiveUser(input.assigneeId);
  await assertRelated(actor, { lead: input.leadId, client: input.clientId, property: input.propertyId, deal: input.dealId, viewing: input.viewingId });
}

const links = (t: { id: string; leadId: string | null; clientId: string | null; propertyId: string | null; dealId: string | null }) => ({
  taskId: t.id,
  leadId: t.leadId,
  clientId: t.clientId,
  propertyId: t.propertyId,
  dealId: t.dealId,
});

async function userName(tx: Tx, id: string | null) {
  if (!id) return null;
  return (await tx.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
}

type CompletionTask = {
  id: string;
  type: TaskType;
  assigneeId: string | null;
  dailyDate: string | null;
  templateId: string | null;
  leadId: string | null;
  clientId: string | null;
  propertyId: string | null;
  dealId: string | null;
  viewingId: string | null;
};

/**
 * Records the agent activity that a completed task represents. Keys are shared with the
 * CRM automations (e.g. a lead's first response) so the same work is never counted twice.
 */
async function onTaskCompleted(tx: Tx, task: CompletionTask, actor: Actor) {
  // Counter-style daily tasks are completed *by* activities, not the other way round.
  if (task.dailyDate && task.templateId) {
    const template = await tx.dailyTaskTemplate.findUnique({ where: { id: task.templateId }, select: { activityType: true } });
    if (template?.activityType) return;
  }
  const activity = TASK_TYPE_ACTIVITY[task.type];
  const agentId = task.assigneeId ?? (isStaff(actor) ? actor.id : null);
  if (!activity || !agentId) return;
  const dedupeKey =
    task.type === "LEAD_RESPONSE" && task.leadId ? `lead-response:${task.leadId}`
    : task.type === "LEAD_QUALIFICATION" && task.leadId ? `lead-qualified:${task.leadId}`
    : task.type === "VIEWING" && task.viewingId ? `viewing-completed:${task.viewingId}`
    : task.type === "NEW_LISTING" && task.propertyId ? `new-listing:${task.propertyId}`
    : `task:${task.id}`;
  await recordWorkActivity(tx, {
    type: activity, agentId, source: "TASK", loggedById: actor.id, dedupeKey, taskId: task.id,
    leadId: task.leadId, clientId: task.clientId, propertyId: task.propertyId, dealId: task.dealId, viewingId: task.viewingId,
  });
  // Answering a lead through its response task also moves it out of "New".
  if (task.type === "LEAD_RESPONSE" && task.leadId) {
    const lead = await tx.lead.findUnique({ where: { id: task.leadId }, select: { status: true } });
    if (lead?.status === "NEW") await tx.lead.update({ where: { id: task.leadId }, data: { status: "CONTACTED", statusChangedAt: new Date() } });
  }
}

/** Reopening a task the same day withdraws the activity its completion recorded. */
async function onTaskReopened(tx: Tx, taskId: string) {
  await tx.agentActivity.deleteMany({ where: { dedupeKey: `task:${taskId}`, businessDate: businessDate() } });
}

const completionSelect = { id: true, title: true, type: true, status: true, assigneeId: true, dailyDate: true, templateId: true, leadId: true, clientId: true, propertyId: true, dealId: true, viewingId: true } as const;

export async function createTask(actor: Actor, input: z.output<typeof taskSchema>) {
  const data = { ...input, assigneeId: input.assigneeId ?? actor.id };
  await checkTask(actor, data);
  return db.$transaction(async (tx) => {
    const now = new Date();
    const task = await tx.task.create({
      data: {
        ...data,
        createdById: actor.id,
        assignedById: data.assigneeId ? actor.id : null,
        startedAt: data.status === "IN_PROGRESS" || data.status === "COMPLETED" ? now : null,
        completedAt: data.status === "COMPLETED" ? now : null,
      },
      select: { ...completionSelect, assignee: { select: { name: true } } },
    });
    await tx.taskEvent.create({ data: { taskId: task.id, actorId: actor.id, type: "CREATED", toValue: data.status } });
    if (task.assigneeId && task.assigneeId !== actor.id) {
      await tx.taskEvent.create({ data: { taskId: task.id, actorId: actor.id, type: "ASSIGNED", toValue: task.assignee?.name ?? null } });
    }
    if (task.status === "COMPLETED") await onTaskCompleted(tx, task, actor);
    await logActivity(tx, {
      action: "CREATED", entityType: "TASK", entityId: task.id, entityLabel: task.title,
      description: `Created task “${task.title}”${task.assignee ? ` for ${task.assignee.name}` : ""}`, userId: actor.id, ...links(task),
    });
    return { id: task.id, title: task.title };
  });
}

async function scopedTask(actor: Actor, id: string) {
  const task = await db.task.findFirst({
    where: { id, ...scope.tasks(actor) },
    select: { id: true, title: true, status: true, priority: true, dueDate: true, assigneeId: true, createdById: true, startedAt: true, completedAt: true },
  });
  if (!task) throw notFound("Task");
  return task;
}

/** Applies a status change (timestamps, history, completion side effects). */
async function applyStatus(tx: Tx, actor: Actor, current: { id: string; status: TaskStatus; startedAt: Date | null }, status: TaskStatus, note?: string | null) {
  const now = new Date();
  const task = await tx.task.update({
    where: { id: current.id },
    data: {
      status,
      startedAt: status === "IN_PROGRESS" || status === "COMPLETED" ? (current.startedAt ?? now) : current.startedAt,
      completedAt: status === "COMPLETED" ? now : null,
    },
    select: completionSelect,
  });
  await tx.taskEvent.create({ data: { taskId: task.id, actorId: actor.id, type: "STATUS_CHANGED", fromValue: current.status, toValue: status, message: note ?? null } });
  if (status === "COMPLETED") await onTaskCompleted(tx, task, actor);
  if (current.status === "COMPLETED" && status !== "COMPLETED") await onTaskReopened(tx, task.id);
  return task;
}

export async function updateTask(actor: Actor, input: z.output<typeof updateTaskSchema>) {
  const { id, ...data } = input;
  const current = await scopedTask(actor, id);
  if (!canEditDetails(actor, current)) throw forbidden("Only the person who created this task or a manager can edit it. You can still change its status and add notes.");
  await checkTask(actor, data);
  return db.$transaction(async (tx) => {
    const { status, ...rest } = data;
    await tx.task.update({ where: { id }, data: { ...rest, ...(current.assigneeId !== data.assigneeId ? { assignedById: actor.id } : {}) } });
    const events: Prisma.TaskEventCreateManyInput[] = [];
    if (current.assigneeId !== data.assigneeId) {
      events.push({ taskId: id, actorId: actor.id, type: "REASSIGNED", fromValue: await userName(tx, current.assigneeId), toValue: await userName(tx, data.assigneeId) });
    }
    if (current.priority !== data.priority) events.push({ taskId: id, actorId: actor.id, type: "PRIORITY_CHANGED", fromValue: PRIORITY_META[current.priority].label, toValue: PRIORITY_META[data.priority].label });
    if ((current.dueDate?.getTime() ?? null) !== (data.dueDate?.getTime() ?? null)) {
      events.push({ taskId: id, actorId: actor.id, type: "DUE_DATE_CHANGED", fromValue: current.dueDate ? formatDateTime(current.dueDate) : null, toValue: data.dueDate ? formatDateTime(data.dueDate) : null });
    }
    if (events.length) await tx.taskEvent.createMany({ data: events });
    else if (current.status === status) await tx.taskEvent.create({ data: { taskId: id, actorId: actor.id, type: "UPDATED" } });
    const task = current.status !== status ? await applyStatus(tx, actor, current, status) : await tx.task.findUniqueOrThrow({ where: { id }, select: completionSelect });
    const completed = current.status !== "COMPLETED" && task.status === "COMPLETED";
    await logActivity(tx, {
      action: completed ? "COMPLETED" : current.status !== task.status ? "STATUS_CHANGED" : "UPDATED", entityType: "TASK", entityId: id, entityLabel: task.title,
      description: completed ? `Completed task “${task.title}”` : current.status !== task.status ? `Task “${task.title}” is now ${TASK_STATUS_META[task.status].label.toLowerCase()}` : `Updated task “${task.title}”`,
      userId: actor.id, ...links(task),
    });
    return { id: task.id, title: task.title, status: task.status };
  });
}

export async function setTaskStatus(actor: Actor, id: string, status: TaskStatus, note?: string | null) {
  const current = await scopedTask(actor, id);
  if (current.status === status) return { id, title: current.title, status };
  return db.$transaction(async (tx) => {
    const task = await applyStatus(tx, actor, current, status, note);
    await logActivity(tx, {
      action: status === "COMPLETED" ? "COMPLETED" : status === "CANCELLED" ? "CANCELLED" : "STATUS_CHANGED", entityType: "TASK", entityId: id, entityLabel: task.title,
      description: status === "COMPLETED" ? `Completed task “${task.title}”` : `Task “${task.title}” is now ${TASK_STATUS_META[status].label.toLowerCase()}`,
      userId: actor.id, ...links(task),
    });
    return { id: task.id, title: task.title, status: task.status };
  });
}

/** Managers/admins hand a task to another agent (or unassign it). */
export async function reassignTask(actor: Actor, input: z.output<typeof reassignTaskSchema>) {
  if (!hasPermission(actor, "tasks.assign")) throw forbidden("Only managers can reassign tasks.");
  const current = await scopedTask(actor, input.id);
  await assertActiveUser(input.assigneeId);
  if (current.assigneeId === input.assigneeId) return { id: current.id };
  return db.$transaction(async (tx) => {
    const task = await tx.task.update({ where: { id: input.id }, data: { assigneeId: input.assigneeId, assignedById: actor.id }, select: { id: true, title: true, leadId: true, clientId: true, propertyId: true, dealId: true } });
    const [from, to] = await Promise.all([userName(tx, current.assigneeId), userName(tx, input.assigneeId)]);
    await tx.taskEvent.create({ data: { taskId: task.id, actorId: actor.id, type: "REASSIGNED", fromValue: from, toValue: to, message: input.note ?? null } });
    await logActivity(tx, {
      action: "ASSIGNED", entityType: "TASK", entityId: task.id, entityLabel: task.title,
      description: to ? `Reassigned task “${task.title}” to ${to}` : `Unassigned task “${task.title}”`, userId: actor.id, ...links(task),
    });
    return { id: task.id };
  });
}

/** Notes on a task (part of its history). */
export async function addTaskNote(actor: Actor, id: string, message: string) {
  await scopedTask(actor, id);
  return db.taskEvent.create({ data: { taskId: id, actorId: actor.id, type: "NOTE", message }, select: { id: true } });
}

export async function deleteTask(actor: Actor, id: string) {
  const current = await scopedTask(actor, id);
  if (!canDelete(actor, current)) throw forbidden("Only the person who created this task or a manager can delete it.");
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id } });
    await logActivity(tx, { action: "DELETED", entityType: "TASK", entityId: id, entityLabel: current.title, description: `Deleted task “${current.title}”`, userId: actor.id });
  });
}

/**
 * Team workload for managers: per staff member — open, in progress, overdue, due today,
 * completed today / this week, and completed-on-time rate this week.
 */
export async function teamWorkload(actor: Actor) {
  if (!hasPermission(actor, "tasks.viewTeam")) throw forbidden();
  const today = businessDate();
  const { start: todayStart, end: todayEnd } = dayRange(today);
  const weekStart = dayRange(shiftDate(today, -((weekday(today) - WEEK_START_DAY + 7) % 7))).start;
  const now = new Date();
  const [users, open, inProgress, overdue, dueToday, doneToday, doneWeek, doneWeekLate] = await Promise.all([
    db.user.findMany({ where: { isActive: true, role: { in: ["AGENT", "MANAGER"] } }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, role: true, avatarUrl: true } }),
    db.task.groupBy({ by: ["assigneeId"], where: { status: { in: OPEN } }, _count: { _all: true } }),
    db.task.groupBy({ by: ["assigneeId"], where: { status: "IN_PROGRESS" }, _count: { _all: true } }),
    db.task.groupBy({ by: ["assigneeId"], where: { status: { in: OPEN }, dueDate: { lt: now } }, _count: { _all: true } }),
    db.task.groupBy({ by: ["assigneeId"], where: { status: { in: OPEN }, dueDate: { gte: todayStart, lt: todayEnd } }, _count: { _all: true } }),
    db.task.groupBy({ by: ["assigneeId"], where: { status: "COMPLETED", completedAt: { gte: todayStart, lt: todayEnd } }, _count: { _all: true } }),
    db.task.groupBy({ by: ["assigneeId"], where: { status: "COMPLETED", completedAt: { gte: weekStart } }, _count: { _all: true } }),
    db.$queryRaw<{ assigneeId: string; n: number }[]>`SELECT "assigneeId", COUNT(*) AS n FROM "Task" WHERE "status" = 'COMPLETED' AND "completedAt" >= ${weekStart} AND "dueDate" IS NOT NULL AND "completedAt" > "dueDate" GROUP BY "assigneeId"`,
  ]);
  const by = (rows: { assigneeId: string | null; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.assigneeId, r._count._all]));
  const [o, ip, od, dt, ct, cw] = [by(open), by(inProgress), by(overdue), by(dueToday), by(doneToday), by(doneWeek)];
  const late = new Map(doneWeekLate.map((r) => [r.assigneeId, Number(r.n)]));
  const rows = users.map((u) => {
    const completedWeek = cw.get(u.id) ?? 0;
    return {
      user: u,
      open: o.get(u.id) ?? 0,
      inProgress: ip.get(u.id) ?? 0,
      overdue: od.get(u.id) ?? 0,
      dueToday: dt.get(u.id) ?? 0,
      completedToday: ct.get(u.id) ?? 0,
      completedWeek,
      onTimeRate: completedWeek ? Math.round(((completedWeek - (late.get(u.id) ?? 0)) / completedWeek) * 100) : null,
    };
  });
  return { rows, unassigned: o.get(null) ?? 0 };
}

export type TeamWorkload = Awaited<ReturnType<typeof teamWorkload>>;
