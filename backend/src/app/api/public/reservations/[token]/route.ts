import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/errors";
import { publicOrigin } from "@/lib/env";
import { optionalText } from "@/schemas/common";
import { paymentDetailsSchema, reservationToken } from "@/schemas/website";
import { cancelByLink, reservationByLink, updatePaymentDetails } from "@/services/reservations";

/** The private link token from the URL (anything malformed is simply "not found"). */
function tokenOf(params: Record<string, string>) {
  const parsed = reservationToken.safeParse(params.token);
  if (!parsed.success) throw notFound("Reservation");
  return parsed.data;
}

const limit = { limit: 60, windowMs: 10 * 60_000 };

/** GET /api/public/reservations/:token — status, deposit, bank details and receipts sent. */
export const GET = apiRoute({ audience: "public", rateLimit: limit }, ({ params, request }) => reservationByLink(tokenOf(params), publicOrigin(request)));

/** PATCH /api/public/reservations/:token — { payerName?, paymentReference? } (Fawran / transfer details). */
export const PATCH = apiRoute({ audience: "public", body: paymentDetailsSchema, rateLimit: limit }, ({ params, body }) => updatePaymentDetails(tokenOf(params), body));

/** DELETE /api/public/reservations/:token — { reason? }. Only before the payment is confirmed. */
export const DELETE = apiRoute(
  { audience: "public", body: z.object({ reason: optionalText(300) }), rateLimit: limit },
  ({ params, body }) => cancelByLink(tokenOf(params), body.reason),
);
