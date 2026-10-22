"use server";

import { z } from "zod";
import { authedAction } from "@/lib/action";
import { id, idOnly } from "@/schemas/common";
import { cancelReservation, confirmReservation } from "@/services/reservations";

export const confirmReservationAction = authedAction(idOnly, (input, user) => confirmReservation(user, input.id), { message: "Payment confirmed — the home is reserved" });
export const cancelReservationAction = authedAction(
  z.object({ id, reason: z.string().trim().min(5, "Write why the reservation is cancelled").max(300) }),
  (input, user) => cancelReservation(user, input.id, input.reason),
  { message: "Reservation cancelled" },
);
