import { apiRoute } from "@/lib/api/handler";
import { publicOrigin } from "@/lib/env";
import { cancelBookingSchema, rescheduleSchema } from "@/schemas/portal";
import { cancelBooking, rescheduleBooking } from "@/services/client-dashboard";

/** PATCH /api/portal/bookings/:id — { startsAt } reschedule (needs the agent's confirmation again). */
export const PATCH = apiRoute({ audience: "client", body: rescheduleSchema, rateLimit: { limit: 20, windowMs: 60 * 60_000 } }, ({ user, params, body, request }) =>
  rescheduleBooking(user, params.id, body.startsAt, publicOrigin(request)),
);

/** DELETE /api/portal/bookings/:id — { reason? } cancel. */
export const DELETE = apiRoute({ audience: "client", body: cancelBookingSchema }, ({ user, params, body }) => cancelBooking(user, params.id, body.reason));
