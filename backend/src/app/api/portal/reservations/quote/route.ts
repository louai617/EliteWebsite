import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { reservationQuote } from "@/services/reservations";

/** GET /api/portal/reservations/quote?property=REF — deposit, payment methods and bank details. */
export const GET = apiRoute({ audience: "client", query: z.object({ property: z.string().trim().min(1).max(40) }) }, ({ user, query }) => reservationQuote(user, query.property));
