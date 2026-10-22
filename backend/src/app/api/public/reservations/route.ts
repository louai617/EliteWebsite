import { apiRoute } from "@/lib/api/handler";
import { guestReservationSchema } from "@/schemas/website";
import { createGuestReservation } from "@/services/reservations";

/**
 * POST /api/public/reservations — { property, method: "FAWRAN" | "CARD", name, phone, email, note? }.
 * Card is "coming soon". Returns { reference, token }: the token opens the private reservation
 * page (/reservation/:token) and is also e-mailed. `website` is a honeypot.
 */
export const POST = apiRoute(
  { audience: "public", body: guestReservationSchema, status: 201, rateLimit: { limit: 5, windowMs: 60 * 60_000 } },
  async ({ body }) => (body.website ? { reference: null, token: null } : createGuestReservation(body)),
);
