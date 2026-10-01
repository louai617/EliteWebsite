import { z } from "zod";
import { DealStatus, DealType } from "@/generated/prisma/enums";
import { id, money, optionalDate, optionalId, optionalText, percent } from "./common";

const dealFields = z.object({
  propertyId: id,
  clientId: id,
  leadId: optionalId,
  agentId: optionalId,
  type: z.enum(DealType),
  status: z.enum(DealStatus),
  amount: money("Deal amount"),
  commissionPercent: percent,
  agentSharePercent: percent,
  contractDate: optionalDate,
  closingDate: optionalDate,
  notes: optionalText(4000),
});

export const dealSchema = dealFields;
export type DealInput = z.input<typeof dealSchema>;
export const updateDealSchema = dealFields.extend({ id });
export const dealStatusSchema = z.object({ id, status: z.enum(DealStatus) });
