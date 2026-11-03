import { z } from "zod";
import { email, optionalText, phone, requiredText } from "./common";

/**
 * Forms on the public website (eliterealestate.qa). Visitors have no accounts: every form
 * carries the visitor's contact details and a honeypot field (`website`) that real visitors
 * never fill; bots that do get a silent fake success.
 */

const honeypot = z.string().max(500).optional();
const ref = z.string().trim().min(1, "Choose a property").max(40);
const optionalEmail = z.preprocess((v) => (v === "" ? undefined : v), email.optional());

export const publicLeadSchema = z.object({
  fullName: requiredText(120, "Full name"),
  phone,
  email: optionalEmail,
  message: optionalText(2000),
  /** Website listing reference or CRM property id, if the enquiry is about a listing. */
  propertyRef: optionalText(120),
  website: honeypot,
});

const contact = {
  name: requiredText(120, "Full name"),
  phone,
  email,
};

export const slotsQuery = z.object({
  property: ref,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

/** Book a viewing: a slot from GET /public/viewings/slots (ISO time) + the visitor's details. */
export const guestBookingSchema = z.object({
  property: ref,
  startsAt: z.coerce.date({ error: "Choose a time" }),
  note: optionalText(500),
  ...contact,
  website: honeypot,
});

/** Reserve a home by paying the booking deposit (Fawran / bank transfer; card is "coming soon"). */
export const guestReservationSchema = z.object({
  property: ref,
  method: z.enum(["FAWRAN", "CARD"]),
  note: optionalText(500),
  ...contact,
  website: honeypot,
});

/** The private reservation link token (base64url, 43 characters). */
export const reservationToken = z.string().regex(/^[A-Za-z0-9_-]{40,64}$/, "Invalid link");

export const paymentDetailsSchema = z.object({ payerName: optionalText(120), paymentReference: optionalText(80) });

/** Multipart receipt upload on the private reservation page (field `file`). */
export const receiptUploadSchema = z.object({ file: z.instanceof(File, { error: "Choose a file" }) });
