import { apiRoute } from "@/lib/api/handler";
import { slotsQuery } from "@/schemas/website";
import { bookingSlots } from "@/services/guest-bookings";

/** GET /api/public/viewings/slots?property=ELT-1031&date=YYYY-MM-DD — free viewing times that day. */
export const GET = apiRoute(
  { audience: "public", query: slotsQuery, rateLimit: { limit: 120, windowMs: 10 * 60_000 } },
  ({ query }) => bookingSlots(query.property, query.date),
);
