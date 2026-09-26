import { z } from "zod";
import { Priority, TaskStatus } from "@/generated/prisma/enums";
import { id, optionalDate, optionalId, optionalText, requiredText } from "./common";

export const taskSchema = z.object({
  title: requiredText(160, "Title"),
  description: optionalText(4000),
  status: z.enum(TaskStatus),
  priority: z.enum(Priority),
  dueDate: optionalDate,
  assigneeId: optionalId,
  leadId: optionalId,
  clientId: optionalId,
  propertyId: optionalId,
  dealId: optionalId,
});
export type TaskInput = z.input<typeof taskSchema>;
export const updateTaskSchema = taskSchema.extend({ id });
export const taskStatusSchema = z.object({ id, status: z.enum(TaskStatus) });
