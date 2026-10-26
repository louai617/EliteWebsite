import { z } from "zod";
import { TaskStatus } from "@/generated/prisma/enums";
import { apiRoute } from "@/lib/api/handler";
import { apiError } from "@/lib/api/response";
import { zodFieldErrors } from "@/lib/action";
import { notFound } from "@/lib/errors";
import { optionalText } from "@/schemas/common";
import { taskSchema, updateTaskSchema } from "@/schemas/task";
import { deleteTask, getTask, setTaskStatus, updateTask } from "@/services/tasks";

/** GET /api/tasks/:id — task with full history. */
export const GET = apiRoute({ audience: "staff" }, async ({ user, params }) => {
  const task = await getTask(user, params.id);
  if (!task) throw notFound("Task");
  return task;
});

const patch = taskSchema.partial().extend({ status: z.enum(TaskStatus).optional(), note: optionalText(2000).optional() });

/**
 * PATCH /api/tasks/:id
 *  - `{ status, note? }` only → status change (allowed for the assignee: start, complete, cancel)
 *  - any other field → detail edit (creator or manager); the merged task is re-validated in full
 */
export const PATCH = apiRoute({ audience: "staff", body: patch }, async ({ user, params, body }) => {
  const { note, ...fields } = body;
  const keys = Object.keys(fields).filter((k) => fields[k as keyof typeof fields] !== undefined);
  if (keys.length === 1 && keys[0] === "status") return setTaskStatus(user, params.id, fields.status!, note);
  const current = await getTask(user, params.id);
  if (!current) throw notFound("Task");
  const parsed = updateTaskSchema.safeParse({ ...current, ...fields, id: params.id });
  if (!parsed.success) return apiError("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  return updateTask(user, parsed.data);
});

export const DELETE = apiRoute({ audience: "staff" }, async ({ user, params }) => {
  await deleteTask(user, params.id);
  return { deleted: true };
});
