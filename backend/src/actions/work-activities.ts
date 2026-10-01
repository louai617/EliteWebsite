"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { propertyPostingSchema, workActivitySchema } from "@/schemas/work-activity";
import { deleteWorkActivity, logWorkActivity, recordPropertyPosting } from "@/services/work-activities";

export const logWorkActivityAction = authedAction(workActivitySchema, async (input, user) => {
  const activity = await logWorkActivity(user, input);
  return { id: activity.id };
}, { message: "Activity logged" });

export const deleteWorkActivityAction = authedAction(idOnly, (input, user) => deleteWorkActivity(user, input.id), { message: "Activity removed" });

export const recordPropertyPostingAction = authedAction(propertyPostingSchema, async (input, user) => {
  const activity = await recordPropertyPosting(user, input);
  return { id: activity.id };
}, { message: "Posting recorded" });
