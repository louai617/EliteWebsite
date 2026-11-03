import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { reservationQuote } from "@/services/reservations";

/** GET /api/public/reservations/quote?property=REF — deposit, payment methods and bank details. */
export const GET = apiRoute(
  { audience: "public", query: z.object({ property: z.string().trim().min(1).max(40) }), rateLimit: { limit: 60, windowMs: 10 * 60_000 } },
  ({ query }) => reservationQuote(query.property),
);
