import { apiRoute } from "@/lib/api/handler";
import { publicOrigin } from "@/lib/env";
import { bookingSchema } from "@/schemas/portal";
import { bookViewing, listBookings } from "@/services/client-dashboard";

/** GET /api/portal/bookings — the client's viewings ({ upcoming, past }). */
export const GET = apiRoute({ audience: "client" }, ({ user, request }) => listBookings(user, publicOrigin(request)));

/** POST /api/portal/bookings — { property: "ELT-1031", startsAt: ISO, note? } (a slot from /slots). */
export const POST = apiRoute(
  { audience: "client", body: bookingSchema, status: 201, rateLimit: { limit: 20, windowMs: 60 * 60_000 } },
  ({ user, body, request }) => bookViewing(user, body, publicOrigin(request)),
);
