import { z } from "zod";
import { isBusinessDate } from "@/lib/business-day";
import { id, optionalId } from "./common";

const time = (label: string) => z.string({ error: `${label} is required` }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label}: use HH:MM, e.g. 16:00`);

/** "Free for viewings" on a day from–to, optionally repeated weekly. */
export const availabilitySchema = z
  .object({
    /** Managers may set it for any agent; agents only for themselves. */
    agentId: optionalId,
    date: z.string({ error: "Choose a day" }).refine(isBusinessDate, "Choose a day"),
    from: time("From"),
    to: time("To"),
    /** Also add the same hours on the same weekday for the next N weeks. */
    repeatWeeks: z.coerce.number().int().min(0).max(12).default(0),
  })
  .refine((v) => v.from < v.to, { path: ["to"], message: "Must be after the start" });
export type AvailabilityInput = z.input<typeof availabilitySchema>;

export const removeAvailabilitySchema = z.object({ id });
