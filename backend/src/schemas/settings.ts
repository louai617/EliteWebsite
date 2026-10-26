import { z } from "zod";
import { WatermarkPosition } from "@/generated/prisma/enums";
import { checkbox, optionalId, optionalText, percent, requiredInt, requiredText } from "./common";

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
  /** A NEW lead untouched this many hours moves to the admin (0 = off). */
  leadAutoReassignHours: requiredInt(0, 168, "Hours"),
  /** Who receives those leads (empty = first active admin). */
  leadEscalationUserId: optionalId,
});
export type SettingsInput = z.input<typeof settingsSchema>;

const iban = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, "").toUpperCase() : null),
  z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, "Enter a valid IBAN (e.g. QA58DOHB00001234567890ABCDEFG)").nullable(),
);
const swift = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : null),
  z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, "Enter a valid SWIFT/BIC code").nullable(),
);

/** Booking deposits and where clients pay them (Fawran / bank transfer). */
export const paymentSettingsSchema = z
  .object({
    fawranEnabled: checkbox,
    saleDepositPercent: percent,
    rentDepositMonths: requiredInt(0, 12, "Months of rent"),
    reservationHoldHours: requiredInt(1, 720, "Time to pay"),
    bankName: optionalText(120),
    bankAccountName: optionalText(120),
    bankIban: iban,
    bankAccountNumber: optionalText(40),
    bankSwift: swift,
    fawranAlias: optionalText(60),
    paymentInstructions: optionalText(1000),
  })
  .refine((v) => !v.fawranEnabled || Boolean(v.bankIban || v.fawranAlias), {
    path: ["bankIban"],
    message: "Add the IBAN or the Fawran alias so clients know where to pay",
  });
export type PaymentSettingsInput = z.input<typeof paymentSettingsSchema>;

/** The watermark stamped on the public copies of listing photos (originals stay clean). */
export const watermarkSettingsSchema = z.object({
  watermarkEnabled: checkbox,
  watermarkPosition: z.enum(WatermarkPosition, { error: "Choose a position" }),
  watermarkSize: requiredInt(10, 60, "Size"),
  watermarkOpacity: requiredInt(10, 90, "Opacity"),
});
export type WatermarkSettingsInput = z.input<typeof watermarkSettingsSchema>;
