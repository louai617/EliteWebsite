import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { hasPermission, type Actor } from "@/lib/permissions";
import { DEFAULT_SCORING_RULES, SCORE_METRICS, type ScoringRules } from "@/lib/scoring";
import type { scoringRulesSchema } from "@/schemas/performance";
import { logActivity } from "./activity";

/** Current weights: code defaults overridden by rows in ScoringRule. */
export async function getScoringRules(): Promise<ScoringRules> {
  const rows = await db.scoringRule.findMany();
  const rules: ScoringRules = { ...DEFAULT_SCORING_RULES };
  for (const row of rows) if (row.metric in rules) rules[row.metric] = { points: row.points, isEnabled: row.isEnabled };
  return rules;
}

/** Admin-only. Changes apply to today's live score and every future day; finalized days keep their stored scores. */
export async function updateScoringRules(actor: Actor, input: z.output<typeof scoringRulesSchema>) {
  if (!hasPermission(actor, "performance.configure")) throw forbidden("Only admins can change scoring weights.");
  const known = new Set(SCORE_METRICS.map((m) => m.key));
  await db.$transaction(async (tx) => {
    for (const rule of input.rules) {
      if (!known.has(rule.metric)) continue;
      await tx.scoringRule.upsert({
        where: { metric: rule.metric },
        create: { metric: rule.metric, points: rule.points, isEnabled: rule.isEnabled, updatedById: actor.id },
        update: { points: rule.points, isEnabled: rule.isEnabled, updatedById: actor.id },
      });
    }
    await logActivity(tx, { action: "UPDATED", entityType: "USER", entityId: actor.id, entityLabel: "Scoring weights", description: "Updated performance scoring weights", userId: actor.id });
  });
  return getScoringRules();
}

export async function resetScoringRules(actor: Actor) {
  if (!hasPermission(actor, "performance.configure")) throw forbidden("Only admins can change scoring weights.");
  await db.scoringRule.deleteMany();
  return getScoringRules();
}
