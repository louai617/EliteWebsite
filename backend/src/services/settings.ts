import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { forbidden, invalid } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import type { z } from "zod";
import type { paymentSettingsSchema, settingsSchema, watermarkSettingsSchema } from "@/schemas/settings";
import { countPendingWatermarks, refreshAllWatermarksInBackground } from "./photo-watermark-job";

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

/**
 * Saves the photo watermark. When anything changed, the version goes up and every uploaded
 * photo's public copy is re-rendered from its clean original in the background.
 */
export async function updateWatermarkSettings(actor: Actor, input: z.output<typeof watermarkSettingsSchema>) {
  if (!can.editSettings(actor)) throw forbidden("Only admins can change the photo watermark.");
  const current = await db.settings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  const changed = (Object.keys(input) as (keyof typeof input)[]).some((k) => current[k] !== input[k]);
  if (changed) await db.settings.update({ where: { id: "default" }, data: { ...input, watermarkVersion: { increment: 1 } } });
  refreshAllWatermarksInBackground();
  return { changed, pending: await countPendingWatermarks() };
}
