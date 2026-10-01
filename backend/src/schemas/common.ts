import { z } from "zod";
import { parseZonedInput } from "@/lib/format";

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (typeof v === "number" && Number.isNaN(v));

export const id = z.cuid("Invalid reference");
export const optionalId = z.preprocess((v) => (blank(v) ? null : v), id.nullable());

export const requiredText = (max = 200, label = "This field") =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `Keep it under ${max} characters`);

export const optionalText = (max = 2000) =>
  z.preprocess((v) => (blank(v) ? null : typeof v === "string" ? v.trim() : v), z.string().max(max, `Keep it under ${max} characters`).nullable());

export const phone = z
  .string({ error: "Phone is required" })
  .trim()
  .min(1, "Phone is required")
  .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, "Enter a valid phone number, e.g. +974 5512 3456");

export const optionalPhone = z.preprocess((v) => (blank(v) ? null : v), phone.nullable());

export const optionalEmail = z.preprocess(
  (v) => (blank(v) ? null : typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email("Enter a valid e-mail address").max(160).nullable(),
);

export const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email("Enter a valid e-mail address").max(160),
);

/** Absolute http(s) URL, optional. */
export const optionalUrl = z.preprocess(
  (v) => (blank(v) ? null : typeof v === "string" ? v.trim() : v),
  z.url({ protocol: /^https?$/, error: "Enter a full URL starting with https://" }).max(1000).nullable(),
);

const toNumber = (v: unknown) => (blank(v) ? null : typeof v === "string" ? Number(v.replace(/,/g, "")) : v);

export const optionalInt = (min = 0, max = 1_000_000) =>
  z.preprocess(toNumber, z.number({ error: "Enter a number" }).int("Whole numbers only").min(min, `Minimum ${min}`).max(max, `Maximum ${max}`).nullable());

export const requiredInt = (min = 0, max = 1_000_000, label = "This field") =>
  z.preprocess(
    (v) => (blank(v) ? undefined : toNumber(v)),
    z.number({ error: `${label} is required` }).int("Whole numbers only").min(min, `Minimum ${min}`).max(max, `Maximum ${max}`),
  );

export const optionalFloat = (min: number, max: number) =>
  z.preprocess(toNumber, z.number({ error: "Enter a number" }).min(min, `Minimum ${min}`).max(max, `Maximum ${max}`).nullable());

export const percent = z.preprocess(
  (v) => (blank(v) ? undefined : toNumber(v)),
  z.number({ error: "Enter a percentage" }).min(0, "Can't be negative").max(100, "Max 100%"),
);

/** Money in whole QAR. */
export const money = (label = "Amount") => requiredInt(0, 10_000_000_000, label);
export const optionalMoney = optionalInt(0, 10_000_000_000);

export const optionalDate = z.preprocess((v) => (blank(v) ? null : parseZonedInput(v)), z.coerce.date({ error: "Enter a valid date" }).nullable());
export const requiredDate = (label = "Date") =>
  z.preprocess((v) => (blank(v) ? undefined : parseZonedInput(v)), z.coerce.date({ error: `${label} is required` }));

export const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const idOnly = z.object({ id });

/** Budget min/max must be consistent. */
export function refineBudget<T extends { budgetMin?: number | null; budgetMax?: number | null }>(value: T, ctx: z.RefinementCtx) {
  if (value.budgetMin != null && value.budgetMax != null && value.budgetMin > value.budgetMax) {
    ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "Max budget must be at least the minimum" });
  }
}
