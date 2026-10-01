import { z } from "zod";
import { SCORE_METRIC_KEYS } from "@/lib/scoring";

export const scoringRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        metric: z.string().refine((v) => SCORE_METRIC_KEYS.includes(v), "Unknown metric"),
        points: z.coerce.number({ error: "Enter a number" }).min(-1000, "Minimum -1000").max(1000, "Maximum 1000"),
        isEnabled: z.boolean(),
      }),
    )
    .min(1)
    .max(SCORE_METRIC_KEYS.length),
});
export type ScoringRulesInput = z.input<typeof scoringRulesSchema>;
