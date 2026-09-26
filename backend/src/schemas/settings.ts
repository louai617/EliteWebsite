import { z } from "zod";
import { percent, requiredText } from "./common";

export const settingsSchema = z.object({
  companyName: requiredText(120, "Company name"),
  defaultCurrency: z.string().trim().length(3, "Use a 3-letter code").toUpperCase(),
  saleCommissionPercent: percent,
  rentalCommissionPercent: percent,
  agentSharePercent: percent,
});
export type SettingsInput = z.input<typeof settingsSchema>;
