import type { TaskStatus } from "@/generated/prisma/enums";

/** Open task whose due time has passed. Safe for server and client components. */
export function isOverdue(task: { dueDate: Date | null; status: TaskStatus }) {
  return Boolean(task.dueDate && new Date(task.dueDate).getTime() < Date.now() && (task.status === "TODO" || task.status === "IN_PROGRESS"));
}
