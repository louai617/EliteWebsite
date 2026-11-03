"use server";

import { z } from "zod";
import { authedAction } from "@/lib/action";
import { scoringRulesSchema } from "@/schemas/performance";
import { resetScoringRules, updateScoringRules } from "@/services/scoring";

export const updateScoringRulesAction = authedAction(scoringRulesSchema, async (input, user) => {
  await updateScoringRules(user, input);
}, { message: "Scoring weights saved" });

export const resetScoringRulesAction = authedAction(z.object({}), async (_input, user) => {
  await resetScoringRules(user);
}, { message: "Scoring weights reset to defaults" });
