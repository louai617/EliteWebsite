"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { dailyReportSubmitSchema, dailyTemplateSchema, updateDailyTemplateSchema } from "@/schemas/daily";
import { createDailyTemplate, deleteDailyTemplate, submitDailyReport, updateDailyTemplate } from "@/services/daily";

export const createDailyTemplateAction = authedAction(dailyTemplateSchema, (input, user) => createDailyTemplate(user, input), { message: "Daily task created" });
export const updateDailyTemplateAction = authedAction(updateDailyTemplateSchema, (input, user) => updateDailyTemplate(user, input), { message: "Daily task updated" });
export const deleteDailyTemplateAction = authedAction(idOnly, (input, user) => deleteDailyTemplate(user, input.id), { message: "Daily task removed" });
export const submitDailyReportAction = authedAction(dailyReportSubmitSchema, async (input, user) => {
  const report = await submitDailyReport(user, input);
  return { id: report.id };
}, { message: "Daily report submitted" });
