import { apiRoute } from "@/lib/api/handler";
import { slotsQuery } from "@/schemas/portal";
import { bookingSlots } from "@/services/client-dashboard";

/** GET /api/portal/bookings/slots?property=ELT-1031&date=YYYY-MM-DD — free viewing times that day. */
export const GET = apiRoute({ audience: "client", query: slotsQuery }, ({ user, query }) => bookingSlots(user, query.property, query.date));
