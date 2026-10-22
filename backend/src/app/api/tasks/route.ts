import { z } from "zod";
import { Priority, TaskStatus, TaskType } from "@/generated/prisma/enums";
import { apiRoute, listQuery } from "@/lib/api/handler";
import { forbidden } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { taskSchema } from "@/schemas/task";
import { TASK_SORTS, createTask, listTasks } from "@/services/tasks";

const query = listQuery.extend({
  sort: z.enum(TASK_SORTS).default("dueDate"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  /** mine = assigned to me; team = everyone (managers). */
  scope: z.enum(["mine", "team"]).default("mine"),
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(Priority).optional(),
  type: z.enum(TaskType).optional(),
  assigneeId: z.string().max(40).optional(),
  due: z.enum(["overdue", "today", "week", "none"]).optional(),
  open: z.enum(["true", "false"]).optional(),
  dailyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  leadId: z.string().max(40).optional(),
  clientId: z.string().max(40).optional(),
  propertyId: z.string().max(40).optional(),
});

/** GET /api/tasks — My tasks (default) or Team tasks (`scope=team`, managers). Searchable, filterable, sortable. */
export const GET = apiRoute({ audience: "staff", query }, async ({ user, query: q }) => {
  if (q.scope === "team" && !hasPermission(user, "tasks.viewTeam")) throw forbidden("Only managers can see team tasks.");
  const { page, pageSize, q: search, sort, dir, scope, open, ...filters } = q;
  return listTasks(user, { page, pageSize, q: search, sort, dir }, { ...filters, mine: scope === "mine", open: open === "true" ? true : undefined });
});

/** POST /api/tasks — create (managers may assign to anyone; agents to themselves). */
export const POST = apiRoute({ audience: "staff", body: taskSchema, status: 201 }, async ({ user, body }) => createTask(user, body));
