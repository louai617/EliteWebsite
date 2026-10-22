import { z } from "zod";
import { CustomerType, ListingPurpose } from "@/generated/prisma/enums";
import { id, optionalEmail, optionalInt, optionalMoney, optionalText, phone, refineBudget } from "./common";

const optionalEnum = <T extends Record<string, string>>(e: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(e).nullable());

/** Only the phone number is required — the rest is whatever is known (or nothing, for a private owner). */
const poolLeadFields = z.object({
  phone,
  fullName: optionalText(120),
  email: optionalEmail,
  leadType: optionalEnum(CustomerType),
  purpose: optionalEnum(ListingPurpose),
  interestedArea: optionalText(120),
  budgetMin: optionalMoney,
  budgetMax: optionalMoney,
  bedrooms: optionalInt(0, 20),
  notes: optionalText(2000),
});

export const poolLeadSchema = poolLeadFields.superRefine(refineBudget);
export type PoolLeadInput = z.input<typeof poolLeadSchema>;
export const updatePoolLeadSchema = poolLeadFields.extend({ id }).superRefine(refineBudget);

/** Many numbers at once: one per line, optionally followed by a name ("+974 5512 3456, Ahmed"). */
export const poolBulkSchema = z.object({
  lines: z.string({ error: "Paste at least one number" }).trim().min(6, "Paste at least one number").max(50_000, "Paste up to about 1,000 lines at a time"),
  leadType: optionalEnum(CustomerType),
  purpose: optionalEnum(ListingPurpose),
  notes: optionalText(2000),
});

export const poolDecisionSchema = z.object({ requestId: id, approve: z.boolean(), note: optionalText(500) });
export const poolRequestIdSchema = z.object({ requestId: id });
/** A manager hands a pool lead straight to an agent (or to themselves). */
export const poolAssignSchema = z.object({ id, agentId: z.cuid("Choose who gets the lead") });
