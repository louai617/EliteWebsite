import { z } from "zod";
import { CustomerType } from "@/generated/prisma/enums";
import { id, optionalEmail, optionalId, optionalMoney, optionalText, phone, refineBudget, requiredText } from "./common";

const clientFields = z.object({
  fullName: requiredText(120, "Name"),
  phone,
  email: optionalEmail,
  nationality: optionalText(60),
  idReference: optionalText(60),
  clientType: z.enum(CustomerType, { error: "Choose a client type" }),
  budgetMin: optionalMoney,
  budgetMax: optionalMoney,
  requirements: optionalText(4000),
  notes: optionalText(4000),
  agentId: optionalId,
});

export const clientSchema = clientFields.superRefine(refineBudget);
export type ClientInput = z.input<typeof clientSchema>;
export const updateClientSchema = clientFields.extend({ id }).superRefine(refineBudget);
export const clientInterestSchema = z.object({ clientId: id, propertyId: id });
