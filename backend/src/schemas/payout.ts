import { z } from "zod";
import { PayoutMethod } from "@/generated/prisma/enums";
import { id, optionalDate, optionalText, requiredInt } from "./common";

/** Paying an agent part (or all) of their commission share. */
export const payoutSchema = z.object({
  agentId: z.cuid("Choose the agent"),
  amount: requiredInt(1, 100_000_000, "Amount"),
  method: z.enum(PayoutMethod, { error: "Choose how it was paid" }),
  note: optionalText(500),
  /** When it was paid (defaults to now). */
  paidAt: optionalDate,
});
export type PayoutInput = z.input<typeof payoutSchema>;

export const voidPayoutSchema = z.object({
  id,
  reason: z.string({ error: "Write why the voucher is cancelled" }).trim().min(5, "Write why the voucher is cancelled").max(300, "Keep it under 300 characters"),
});
