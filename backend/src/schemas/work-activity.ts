import { z } from "zod";
import { WorkActivityType } from "@/generated/prisma/enums";
import { optionalDate, optionalId, optionalInt, optionalText } from "./common";

export const workActivitySchema = z.object({
  type: z.enum(WorkActivityType, { error: "Choose what you did" }),
  /** Managers may log for an agent; defaults to the signed-in user. */
  agentId: optionalId,
  occurredAt: optionalDate,
  outcome: optionalText(200),
  notes: optionalText(2000),
  durationMin: optionalInt(0, 600),
  taskId: optionalId,
  leadId: optionalId,
  clientId: optionalId,
  propertyId: optionalId,
  viewingId: optionalId,
  dealId: optionalId,
});
export type WorkActivityInput = z.input<typeof workActivitySchema>;

export const propertyPostingSchema = z.object({
  propertyId: z.cuid(),
  kind: z.enum(["PROPERTY_POST", "PROPERTY_REPOST"]),
  /** Where it was posted (e.g. Property Finder, Qatar Living, Instagram). */
  outcome: optionalText(200),
});
