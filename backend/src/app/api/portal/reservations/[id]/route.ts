import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { optionalText } from "@/schemas/common";
import { cancelClientReservation, updatePaymentDetails } from "@/services/reservations";

/** PATCH /api/portal/reservations/:id — { payerName?, paymentReference? } (Fawran / transfer details). */
export const PATCH = apiRoute(
  { audience: "client", body: z.object({ payerName: optionalText(120), paymentReference: optionalText(80) }) },
  ({ user, params, body }) => updatePaymentDetails(user, params.id, body),
);

/** DELETE /api/portal/reservations/:id — { reason? }. Only before the payment is confirmed. */
export const DELETE = apiRoute({ audience: "client", body: z.object({ reason: optionalText(300) }) }, ({ user, params, body }) => cancelClientReservation(user, params.id, body.reason));
