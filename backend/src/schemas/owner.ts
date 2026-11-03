import { z } from "zod";
import { id, optionalEmail, optionalPhone, optionalText, phone, requiredText } from "./common";

export const ownerSchema = z.object({
  fullName: requiredText(120, "Name"),
  phone,
  secondaryPhone: optionalPhone,
  email: optionalEmail,
  nationality: optionalText(60),
  notes: optionalText(4000),
});
export type OwnerInput = z.input<typeof ownerSchema>;
export const updateOwnerSchema = ownerSchema.extend({ id });
