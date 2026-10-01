import { z } from "zod";
import { CustomerType } from "@/generated/prisma/enums";
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
  /** Honeypot — must stay empty (bots fill every field). */
  website: z.string().max(0, "Invalid submission").optional(),
});
