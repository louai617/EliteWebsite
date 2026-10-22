import { z } from "zod";
import { Priority, TaskType, WorkActivityType } from "@/generated/prisma/enums";
import { checkbox, id, optionalId, optionalText, requiredInt, requiredText } from "./common";

export const dailyTemplateSchema = z.object({
  title: requiredText(160, "Title"),
  description: optionalText(2000),
  taskType: z.preprocess((v) => (v === "" || v == null ? "GENERAL" : v), z.enum(TaskType)),
  /** Activity that counts towards the target; empty = the agent ticks the task off manually. */
  activityType: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(WorkActivityType).nullable()),
  targetCount: requiredInt(1, 500, "Target"),
  priority: z.enum(Priority),
  dueHour: requiredInt(0, 23, "Due hour"),
  isActive: checkbox,
  /** Empty = every active agent. */
  assigneeId: optionalId,
});
export type DailyTemplateInput = z.input<typeof dailyTemplateSchema>;
export const updateDailyTemplateSchema = dailyTemplateSchema.extend({ id });

export const dailyReportSubmitSchema = z.object({
  summary: requiredText(4000, "Summary"),
  blockers: optionalText(2000),
});
export type DailyReportSubmitInput = z.input<typeof dailyReportSubmitSchema>;
