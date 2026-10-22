import { z } from "zod";
import { CustomerType, Furnishing, LeadSource, LeadStatus, ListingPurpose, Priority } from "@/generated/prisma/enums";
import { checkbox, id, money, optionalEmail, optionalId, optionalInt, optionalMoney, optionalText, phone, refineBudget, requiredText } from "./common";

const optionalEnum = <T extends Record<string, string>>(e: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(e).nullable());

const leadFields = z.object({
  fullName: requiredText(120, "Name"),
  phone,
  email: optionalEmail,
  nationality: optionalText(60),
  source: z.enum(LeadSource, { error: "Choose a source" }),
  leadType: optionalEnum(CustomerType),
  interestedPropertyId: optionalId,
  interestedArea: optionalText(120),
  purpose: optionalEnum(ListingPurpose),
  budgetMin: optionalMoney,
  budgetMax: optionalMoney,
  bedrooms: optionalInt(0, 20),
  furnishing: optionalEnum(Furnishing),
  notes: optionalText(4000),
  agentId: optionalId,
  status: z.enum(LeadStatus),
  priority: z.enum(Priority),
});

export const leadSchema = leadFields.superRefine(refineBudget);
export type LeadInput = z.input<typeof leadSchema>;
export const updateLeadSchema = leadFields.extend({ id }).superRefine(refineBudget);

export const leadStatusSchema = z.object({ id, status: z.enum(LeadStatus) });
export const leadAssignSchema = z.object({ id, agentId: optionalId });
export const leadInterestSchema = z.object({ leadId: id, propertyId: id });
export const convertLeadSchema = z.object({ id });

/** Won: the deal opens as "Pending contract" for this property and agreed price. */
export const markWonSchema = z.object({
  id,
  propertyId: z.cuid("Choose the property"),
  amount: money("Agreed price"),
  notes: optionalText(2000),
});

/** Lost: a reason is mandatory. */
export const markLostSchema = z.object({
  id,
  reason: z.string({ error: "Write why the lead was lost" }).trim().min(5, "Write why the lead was lost").max(500, "Keep it under 500 characters"),
});

/** Ask to move past the viewing stage without a viewing form. */
export const passRequestSchema = z.object({
  leadId: id,
  reason: z.string({ error: "Explain why there is no viewing form" }).trim().min(10, "Explain in a sentence why there is no viewing form").max(1000, "Keep it under 1000 characters"),
});

export const passDecisionSchema = z.object({ requestId: id, approve: z.boolean(), note: optionalText(500) });

/** Managers move many leads at once: everything (open) from one agent, or a picked list. */
export const bulkReassignSchema = z.object({
  /** An agent id, or "none" for unassigned leads. */
  fromAgentId: z.union([z.literal("none"), id], { error: "Choose whose leads to move" }),
  toAgentId: z.cuid("Choose who receives the leads"),
  onlyNew: checkbox,
});
