import { z } from "zod";
import { CustomerType, Furnishing, LeadSource, LeadStatus, ListingPurpose, Priority } from "@/generated/prisma/enums";
import { id, optionalEmail, optionalId, optionalInt, optionalMoney, optionalText, phone, refineBudget, requiredText } from "./common";

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
