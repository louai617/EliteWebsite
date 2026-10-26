"use server";

import { authedAction } from "@/lib/action";
import { payoutSchema, voidPayoutSchema } from "@/schemas/payout";
import { createPayout, voidPayout } from "@/services/payouts";

export const createPayoutAction = authedAction(payoutSchema, (input, user) => createPayout(user, input), {
  message: (r) => `Voucher ${(r as { reference: string }).reference} issued`,
});
export const voidPayoutAction = authedAction(voidPayoutSchema, (input, user) => voidPayout(user, input), {
  message: (r) => `Voucher ${(r as { reference: string }).reference} cancelled — the amount is back on the balance`,
});
