import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { forbidden, invalid } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import type { z } from "zod";
import type { paymentSettingsSchema, settingsSchema } from "@/schemas/settings";

export const getSettings = cache(async () => {
  return db.settings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
});

export async function updateSettings(actor: Actor, input: z.output<typeof settingsSchema>) {
  if (!can.editSettings(actor)) throw forbidden("Only admins can change company settings.");
  if (input.leadEscalationUserId) {
    const target = await db.user.findFirst({ where: { id: input.leadEscalationUserId, isActive: true, role: { in: ["ADMIN", "MANAGER"] } }, select: { id: true } });
    if (!target) throw invalid("Choose an active admin or manager.", { leadEscalationUserId: ["Not an active admin or manager"] });
  }
  return db.settings.upsert({ where: { id: "default" }, create: { id: "default", ...input }, update: input });
}

export async function updatePaymentSettings(actor: Actor, input: z.output<typeof paymentSettingsSchema>) {
  if (!can.editSettings(actor)) throw forbidden("Only admins can change payment settings.");
  return db.settings.upsert({ where: { id: "default" }, create: { id: "default", ...input }, update: input });
}
