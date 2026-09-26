import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import type { z } from "zod";
import type { settingsSchema } from "@/schemas/settings";

export const getSettings = cache(async () => {
  return db.settings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
});

export async function updateSettings(actor: Actor, input: z.output<typeof settingsSchema>) {
  if (!can.editSettings(actor)) throw forbidden("Only admins can change company settings.");
  return db.settings.upsert({ where: { id: "default" }, create: { id: "default", ...input }, update: input });
}
