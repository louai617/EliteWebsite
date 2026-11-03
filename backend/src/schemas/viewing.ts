import { z } from "zod";
import { ViewingStatus } from "@/generated/prisma/enums";
import { id, optionalId, optionalText, requiredDate } from "./common";

const viewingFields = z.object({
  propertyId: id,
  leadId: optionalId,
  clientId: optionalId,
  agentId: optionalId,
  startsAt: requiredDate("Start time"),
  endsAt: requiredDate("End time"),
  status: z.enum(ViewingStatus),
  notes: optionalText(2000),
});

function refineViewing(v: z.output<typeof viewingFields>, ctx: z.RefinementCtx) {
  if (!v.leadId && !v.clientId) {
    ctx.addIssue({ code: "custom", path: ["leadId"], message: "Choose a lead or a client" });
  }
  if (v.endsAt <= v.startsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after the start time" });
  }
  if (v.endsAt.getTime() - v.startsAt.getTime() > 8 * 3_600_000) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "A viewing can't last more than 8 hours" });
  }
}

export const viewingSchema = viewingFields.superRefine(refineViewing);
export type ViewingInput = z.input<typeof viewingSchema>;
export const updateViewingSchema = viewingFields.extend({ id }).superRefine(refineViewing);
export const viewingStatusSchema = z.object({ id, status: z.enum(ViewingStatus), notes: optionalText(2000).optional() });
