import { z } from "zod";
import { checkbox, percent, requiredInt, requiredText } from "./common";

export const settingsSchema = z.object({
  companyName: requiredText(120, "Company name"),
  defaultCurrency: z.string().trim().length(3, "Use a 3-letter code").toUpperCase(),
  saleCommissionPercent: percent,
  rentalCommissionPercent: percent,
  agentSharePercent: percent,
  /** Minutes an agent has to answer a newly assigned lead (due time of the auto task). */
  leadResponseSlaMinutes: requiredInt(5, 1440, "Response time"),
  /** Create a "Respond to new lead" task automatically when a lead is assigned. */
  autoLeadResponseTasks: checkbox,
});
export type SettingsInput = z.input<typeof settingsSchema>;
