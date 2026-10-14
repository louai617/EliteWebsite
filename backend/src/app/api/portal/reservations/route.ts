import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { publicOrigin } from "@/lib/env";
import { optionalText } from "@/schemas/common";
import { createReservation, listClientReservations } from "@/services/reservations";

/** GET /api/portal/reservations — the client's reservations + payment methods and bank details. */
export const GET = apiRoute({ audience: "client" }, ({ user, request }) => listClientReservations(user, publicOrigin(request)));

/** POST /api/portal/reservations — { property, method: "FAWRAN" | "CARD", note? }. Card is "coming soon". */
export const POST = apiRoute(
  {
    audience: "client",
    body: z.object({ property: z.string().trim().min(1).max(40), method: z.enum(["FAWRAN", "CARD"]), note: optionalText(500) }),
    rateLimit: { limit: 10, windowMs: 10 * 60_000 },
    status: 201,
  },
  ({ user, body, request }) => createReservation(user, body, publicOrigin(request)),
);
