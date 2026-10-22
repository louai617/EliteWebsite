import { apiRoute } from "@/lib/api/handler";
import { guestBookingSchema } from "@/schemas/website";
import { bookGuestViewing } from "@/services/guest-bookings";

/**
 * POST /api/public/viewings — { property, startsAt (a slot from /slots), name, phone, email, note? }.
 * No account needed: the booking becomes a viewing on a WEBSITE lead for the listing's agent.
 * Rate-limited per IP; `website` is a honeypot that must stay empty.
 */
export const POST = apiRoute(
  { audience: "public", body: guestBookingSchema, status: 201, rateLimit: { limit: 5, windowMs: 60 * 60_000 } },
  async ({ body }) => (body.website ? { startsAt: body.startsAt.toISOString(), received: true } : bookGuestViewing(body)),
);
