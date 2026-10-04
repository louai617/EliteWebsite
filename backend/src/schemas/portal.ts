import { z } from "zod";
import { CustomerType, ListingPurpose, PropertyType } from "@/generated/prisma/enums";
import { email, id, optionalText, phone, requiredText } from "./common";
import { passwordRule } from "./user";

/** Self-registration on the website (creates a CLIENT account + a CRM client record). */
export const registerClientSchema = z.object({
  name: requiredText(120, "Full name"),
  email,
  phone,
  password: passwordRule,
  clientType: z.enum(CustomerType).optional(),
});

/** Staff grant (or re-enable) portal access for an existing CRM client. */
export const portalAccessSchema = z.object({
  clientId: id,
  email,
  password: passwordRule,
});

export const portalAccountUpdateSchema = z.object({
  name: requiredText(120, "Full name"),
  phone,
});

export const portalEnquirySchema = z.object({
  message: requiredText(2000, "Message"),
  propertyId: id.optional(),
});

export const publicLeadSchema = z.object({
  fullName: requiredText(120, "Full name"),
  phone,
  email: z.preprocess((v) => (v === "" ? undefined : v), email.optional()),
  message: optionalText(2000),
  /** Website listing reference or CRM property id, if the enquiry is about a listing. */
  propertyRef: optionalText(120),
  /** Honeypot — real visitors never fill it; bots that do get a silent fake success. */
  website: z.string().max(500).optional(),
});

// ───────── Client dashboard (website) ─────────

const ref = z.string().trim().min(1, "Choose a property").max(40);

/** Book a viewing: a slot from GET /portal/bookings/slots (ISO time). */
export const bookingSchema = z.object({
  property: ref,
  startsAt: z.coerce.date({ error: "Choose a time" }),
  note: optionalText(500),
});

export const rescheduleSchema = z.object({ startsAt: z.coerce.date({ error: "Choose a time" }) });

export const cancelBookingSchema = z.object({ reason: optionalText(300) });

export const slotsQuery = z.object({
  property: ref,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

export const saveSchema = z.object({ property: ref });

const jsonArray = <T extends z.ZodType>(item: T, max: number) => z.array(item).max(max).default([]);

export const preferencesSchema = z.object({
  purpose: z.preprocess((v) => (v === "" || v == null ? null : String(v).toUpperCase()), z.enum(ListingPurpose).nullable()),
  types: jsonArray(z.enum(PropertyType), 12),
  areas: jsonArray(z.string().trim().min(1).max(120), 15),
  bedrooms: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(20).nullable()),
  budgetMin: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(1_000_000_000).nullable()),
  budgetMax: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(1_000_000_000).nullable()),
  requirements: optionalText(1000),
}).refine((v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax, { path: ["budgetMax"], message: "Maximum must be at least the minimum" });
