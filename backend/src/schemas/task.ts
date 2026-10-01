import { z } from "zod";
import { Priority, TaskStatus, TaskType } from "@/generated/prisma/enums";
import { checkbox, id, optionalDate, optionalId, optionalText, requiredText } from "./common";

export const taskSchema = z.object({
  title: requiredText(160, "Title"),
  description: optionalText(4000),
  type: z.preprocess((v) => (v === "" || v === undefined || v === null ? "GENERAL" : v), z.enum(TaskType)),
  status: z.enum(TaskStatus),
  priority: z.enum(Priority),
  dueDate: optionalDate,
  assigneeId: optionalId,
  leadId: optionalId,
  clientId: optionalId,
  propertyId: optionalId,
  dealId: optionalId,
  viewingId: optionalId,
  /** Show this task to the client in the client portal ("next steps"). */
  clientVisible: checkbox,
});
export type TaskInput = z.input<typeof taskSchema>;
export const updateTaskSchema = taskSchema.extend({ id });
export const taskStatusSchema = z.object({ id, status: z.enum(TaskStatus), note: optionalText(2000).optional() });
export const reassignTaskSchema = z.object({ id, assigneeId: optionalId, note: optionalText(2000).optional() });
export const taskNoteSchema = z.object({ id, message: requiredText(2000, "Note") });
