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

const ids = z.array(id).min(1, "Select at least one").max(100, "Select up to 100 at a time");

/** Managers give the ticked entries (or a single one) to an agent. */
export const poolAssignManySchema = z.object({ ids, agentId: z.cuid("Choose who gets the leads") });
export const poolIdsSchema = z.object({ ids });

/** An Excel (.xlsx) or CSV file of numbers. */
export const poolImportSchema = z
  .instanceof(FormData)
  .transform((fd) => ({ file: fd.get("file") }))
  .pipe(z.object({ file: z.instanceof(File, { error: "Choose a file" }).refine((f) => f.size > 0, "The file is empty").refine((f) => f.size <= 10 * 1024 * 1024, "The file is too large (10 MB max)") }));
