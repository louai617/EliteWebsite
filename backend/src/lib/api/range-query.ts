import { z } from "zod";
import { RANGE_PRESETS, resolveRange } from "@/lib/business-day";

/** ?preset=today|yesterday|week|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD */
export const rangeQuery = z
  .object({
    preset: z.enum(RANGE_PRESETS).default("today"),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    agentId: z.string().max(40).optional(),
  })
  .transform(({ preset, from, to, agentId }) => ({ range: resolveRange(preset, { from, to }), agentId }));
