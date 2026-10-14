import { z } from "zod";
import { DealStatus, DealType } from "@/generated/prisma/enums";
import { id, money, optionalDate, optionalId, optionalText, percent } from "./common";

const dealFields = z.object({
  propertyId: id,
  /** Empty while the deal is pending: closing the deal turns the lead into a client. */
  clientId: optionalId,
  leadId: optionalId,
  agentId: optionalId,
  type: z.enum(DealType),
  amount: money("Deal amount"),
  commissionPercent: percent,
  agentSharePercent: percent,
  contractDate: optionalDate,
  closingDate: optionalDate,
  notes: optionalText(4000),
});

const needsParty = (v: { clientId: string | null; leadId: string | null }) => Boolean(v.clientId || v.leadId);
const partyIssue = { path: ["clientId"], message: "Choose the client or the lead this deal is for" };

export const dealSchema = dealFields.refine(needsParty, partyIssue);
export type DealInput = z.input<typeof dealSchema>;
export const updateDealSchema = dealFields.extend({ id }).refine(needsParty, partyIssue);

/** Pending contract → Closed / Cancelled (a reason is required to cancel). */
export const dealStatusSchema = z
  .object({ id, status: z.enum(DealStatus), reason: optionalText(500) })
  .refine((v) => v.status !== "CANCELLED" || (v.reason?.length ?? 0) >= 5, { path: ["reason"], message: "Write why the deal was cancelled" });
