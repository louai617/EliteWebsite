import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { canAssignTo, isManager, scope, type Actor } from "@/lib/permissions";
import { TASK_STATUS_META } from "@/lib/constants";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { like } from "@/lib/search";
import { zonedDayStart } from "@/lib/format";
import type { taskSchema, updateTaskSchema } from "@/schemas/task";
import { logActivity } from "./activity";
import { assertActiveUser, assertRelated } from "./access";

export const TASK_SORTS = ["dueDate", "createdAt", "updatedAt", "title"] as const;
export type DueFilter = "overdue" | "today" | "week" | "none";

export interface TaskFilters {
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  due?: DueFilter;
  open?: boolean;
  leadId?: string;
  clientId?: string;
  propertyId?: string;
  dealId?: string;
}

/** Doha-time day window. */
function dayBounds(offsetDays = 0) {
  return { start: zonedDayStart(offsetDays), end: zonedDayStart(offsetDays + 1) };
}

function dueWhere(due: DueFilter | undefined): Prisma.TaskWhereInput {
  const today = dayBounds();
  switch (due) {
    case "overdue":
      return { dueDate: { lt: new Date() }, status: { in: ["TODO", "IN_PROGRESS"] } };
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
  status: true,
  priority: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  assigneeId: true,
  createdById: true,
  leadId: true,
  clientId: true,
  propertyId: true,
  dealId: true,
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  lead: { select: { id: true, fullName: true } },
  client: { select: { id: true, fullName: true } },
  property: { select: { id: true, reference: true } },
  deal: { select: { id: true, reference: true } },
} satisfies Prisma.TaskSelect;

export type TaskItem = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

function taskWhere(actor: Actor, q: string | undefined, filters: TaskFilters): Prisma.TaskWhereInput {
  return {
    AND: [
      scope.tasks(actor),
      q ? { OR: [{ title: like(q) }, { description: like(q) }] } : {},
      filters.status ? { status: filters.status } : {},
      filters.open ? { status: { in: ["TODO", "IN_PROGRESS"] } } : {},
      filters.priority ? { priority: filters.priority } : {},
      filters.assigneeId ? (filters.assigneeId === "none" ? { assigneeId: null } : { assigneeId: filters.assigneeId }) : {},
      dueWhere(filters.due),
      filters.leadId ? { leadId: filters.leadId } : {},
      filters.clientId ? { clientId: filters.clientId } : {},
      filters.propertyId ? { propertyId: filters.propertyId } : {},
      filters.dealId ? { dealId: filters.dealId } : {},
    ],
  };
}

export function countTasks(actor: Actor, q: string | undefined, filters: TaskFilters) {
  return db.task.count({ where: taskWhere(actor, q, filters) });
}

export async function listTasks(actor: Actor, params: ListParams<(typeof TASK_SORTS)[number]>, filters: TaskFilters) {
  const where = taskWhere(actor, params.q, filters);
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
    where: { AND: [scope.tasks(actor), { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: end } }] },
    orderBy: [{ dueDate: "asc" }],
    take,
    select: taskSelect,
  });
}

async function checkTask(actor: Actor, input: z.output<typeof taskSchema>) {
  if (!canAssignTo(actor, input.assigneeId)) throw forbidden("You can only assign tasks to yourself.");
  await assertActiveUser(input.assigneeId);
  await assertRelated(actor, { lead: input.leadId, client: input.clientId, property: input.propertyId, deal: input.dealId });
}

const links = (t: { id: string; leadId: string | null; clientId: string | null; propertyId: string | null; dealId: string | null }) => ({
  taskId: t.id,
  leadId: t.leadId,
  clientId: t.clientId,
  propertyId: t.propertyId,
  dealId: t.dealId,
});

export async function createTask(actor: Actor, input: z.output<typeof taskSchema>) {
  const data = { ...input, assigneeId: input.assigneeId ?? actor.id };
  await checkTask(actor, data);
  return db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: { ...data, createdById: actor.id, completedAt: data.status === "COMPLETED" ? new Date() : null },
      select: { id: true, title: true, leadId: true, clientId: true, propertyId: true, dealId: true, assignee: { select: { name: true } } },
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "TASK", entityId: task.id, entityLabel: task.title,
      description: `Created task “${task.title}”${task.assignee ? ` for ${task.assignee.name}` : ""}`, userId: actor.id, ...links(task),
    });
    return task;
  });
}

async function scopedTask(actor: Actor, id: string) {
  const task = await db.task.findFirst({ where: { id, ...scope.tasks(actor) }, select: { id: true, status: true, assigneeId: true, createdById: true, completedAt: true } });
  if (!task) throw notFound("Task");
  return task;
}

export async function updateTask(actor: Actor, input: z.output<typeof updateTaskSchema>) {
  const { id, ...data } = input;
  const current = await scopedTask(actor, id);
  await checkTask(actor, data);
  return db.$transaction(async (tx) => {
    const completedAt = data.status === "COMPLETED" ? (current.completedAt ?? new Date()) : null;
    const task = await tx.task.update({ where: { id }, data: { ...data, completedAt }, select: { id: true, title: true, status: true, leadId: true, clientId: true, propertyId: true, dealId: true } });
    const completed = current.status !== "COMPLETED" && task.status === "COMPLETED";
    await logActivity(tx, {
      action: completed ? "COMPLETED" : current.status !== task.status ? "STATUS_CHANGED" : "UPDATED", entityType: "TASK", entityId: id, entityLabel: task.title,
      description: completed ? `Completed task “${task.title}”` : current.status !== task.status ? `Task “${task.title}” is now ${TASK_STATUS_META[task.status].label.toLowerCase()}` : `Updated task “${task.title}”`,
      userId: actor.id, ...links(task),
    });
    return task;
  });
}

export async function setTaskStatus(actor: Actor, id: string, status: TaskStatus) {
  const current = await scopedTask(actor, id);
  if (current.status === status) return current;
  return db.$transaction(async (tx) => {
    const task = await tx.task.update({
      where: { id },
      data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
      select: { id: true, title: true, status: true, leadId: true, clientId: true, propertyId: true, dealId: true },
    });
    await logActivity(tx, {
      action: status === "COMPLETED" ? "COMPLETED" : status === "CANCELLED" ? "CANCELLED" : "STATUS_CHANGED", entityType: "TASK", entityId: id, entityLabel: task.title,
      description: status === "COMPLETED" ? `Completed task “${task.title}”` : `Task “${task.title}” is now ${TASK_STATUS_META[status].label.toLowerCase()}`,
      userId: actor.id, ...links(task),
    });
    return task;
  });
}

export async function deleteTask(actor: Actor, id: string) {
  const current = await scopedTask(actor, id);
  if (!isManager(actor) && current.createdById !== actor.id && current.assigneeId !== actor.id) throw forbidden();
  const task = await db.task.findUnique({ where: { id }, select: { title: true } });
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id } });
    await logActivity(tx, { action: "DELETED", entityType: "TASK", entityId: id, entityLabel: task?.title ?? "Task", description: `Deleted task “${task?.title ?? ""}”`, userId: actor.id });
  });
}
