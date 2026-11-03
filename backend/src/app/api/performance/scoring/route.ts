import { apiRoute } from "@/lib/api/handler";
import { SCORE_METRICS } from "@/lib/scoring";
import { scoringRulesSchema } from "@/schemas/performance";
import { getScoringRules, resetScoringRules, updateScoringRules } from "@/services/scoring";

const describe = async () => {
  const rules = await getScoringRules();
  return SCORE_METRICS.map((m) => ({ metric: m.key, label: m.label, description: m.description, kind: m.kind, defaultPoints: m.defaultPoints, ...rules[m.key] }));
};

/** GET /api/performance/scoring — metric definitions with current weights. */
export const GET = apiRoute({ audience: "staff" }, describe);

/** PUT /api/performance/scoring — admins change weights (applies to today and future days). */
export const PUT = apiRoute({ audience: "staff", permission: "performance.configure", body: scoringRulesSchema }, async ({ user, body }) => {
  await updateScoringRules(user, body);
  return describe();
});

/** DELETE /api/performance/scoring — back to the defaults. */
export const DELETE = apiRoute({ audience: "staff", permission: "performance.configure" }, async ({ user }) => {
  await resetScoringRules(user);
  return describe();
});
