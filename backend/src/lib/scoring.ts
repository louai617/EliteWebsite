/**
 * Agent performance scoring — the single place where metrics and their default weights are
 * defined. The score is transparent by construction: it is a plain sum of
 *
 *     points-per-unit × measured value        (count metrics, e.g. 1 point per call)
 *     points × ratio                          (ratio metrics, e.g. 10 × response rate)
 *     points if achieved                      (flag metrics, e.g. daily report submitted)
 *
 * and every daily score is stored with this breakdown, so anyone can see exactly why an
 * agent scored what they did. Weights are configurable at runtime (ScoringRule table, edited
 * by admins under Performance › Scoring) — no code changes needed to rebalance.
 *
 * Client-safe: no server imports.
 */

export interface DailyMetrics {
  callsMade: number;
  leadsReceived: number;
  leadsAnswered: number;
  leadsConverted: number;
  propertiesPosted: number;
  propertiesReposted: number;
  newListings: number;
  viewingsCompleted: number;
  followUpsCompleted: number;
  qualificationsDone: number;
  tasksCompleted: number;
  tasksOutstanding: number;
  tasksOverdue: number;
  dailyTasksAssigned: number;
  dailyTasksCompleted: number;
  avgLeadResponseMinutes: number | null;
  avgTaskCompletionHours: number | null;
  reportSubmitted: boolean;
}

export type MetricKind = "count" | "ratio" | "flag" | "speed";

export interface ScoreMetric {
  key: string;
  label: string;
  description: string;
  kind: MetricKind;
  defaultPoints: number;
  /** count: the number of units; ratio/speed: 0…1 (null = not applicable); flag: 1/0. */
  measure: (m: DailyMetrics) => number | null;
  /** Human-readable value shown next to the points. */
  display: (m: DailyMetrics) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const SCORE_METRICS: ScoreMetric[] = [
  { key: "tasksCompleted", label: "Tasks completed", description: "Points for every task completed that day.", kind: "count", defaultPoints: 2, measure: (m) => m.tasksCompleted, display: (m) => `${m.tasksCompleted} tasks` },
  { key: "tasksOverdue", label: "Overdue tasks", description: "Penalty for every open task past its due time at the end of the day.", kind: "count", defaultPoints: -3, measure: (m) => m.tasksOverdue, display: (m) => `${m.tasksOverdue} overdue` },
  { key: "callsMade", label: "Calls made", description: "Points per logged phone call.", kind: "count", defaultPoints: 1, measure: (m) => m.callsMade, display: (m) => `${m.callsMade} calls` },
  { key: "leadsAnswered", label: "Leads answered", description: "Points per lead given a first response.", kind: "count", defaultPoints: 3, measure: (m) => m.leadsAnswered, display: (m) => `${m.leadsAnswered} answered` },
  {
    key: "leadResponseRate",
    label: "Lead response rate",
    description: "Points × (leads answered ÷ leads received). Not applied on days without new leads.",
    kind: "ratio",
    defaultPoints: 10,
    measure: (m) => (m.leadsReceived > 0 ? Math.min(1, m.leadsAnswered / m.leadsReceived) : null),
    display: (m) => (m.leadsReceived > 0 ? `${m.leadsAnswered}/${m.leadsReceived} (${pct(Math.min(1, m.leadsAnswered / m.leadsReceived))})` : "no new leads"),
  },
  { key: "followUpsCompleted", label: "Follow-ups", description: "Points per lead or client follow-up.", kind: "count", defaultPoints: 2, measure: (m) => m.followUpsCompleted, display: (m) => `${m.followUpsCompleted} follow-ups` },
  { key: "qualificationsDone", label: "Leads qualified", description: "Points per lead qualified.", kind: "count", defaultPoints: 2, measure: (m) => m.qualificationsDone, display: (m) => `${m.qualificationsDone} qualified` },
  { key: "propertiesPosted", label: "Properties posted", description: "Points per listing posted on a portal.", kind: "count", defaultPoints: 3, measure: (m) => m.propertiesPosted, display: (m) => `${m.propertiesPosted} posted` },
  { key: "propertiesReposted", label: "Properties reposted", description: "Points per listing refreshed/reposted.", kind: "count", defaultPoints: 1, measure: (m) => m.propertiesReposted, display: (m) => `${m.propertiesReposted} reposted` },
  { key: "newListings", label: "New listings", description: "Points per new property added to the inventory.", kind: "count", defaultPoints: 4, measure: (m) => m.newListings, display: (m) => `${m.newListings} listings` },
  { key: "viewingsCompleted", label: "Viewings completed", description: "Points per viewing that took place.", kind: "count", defaultPoints: 5, measure: (m) => m.viewingsCompleted, display: (m) => `${m.viewingsCompleted} viewings` },
  { key: "leadsConverted", label: "Conversions", description: "Points per lead won / deal closed.", kind: "count", defaultPoints: 25, measure: (m) => m.leadsConverted, display: (m) => `${m.leadsConverted} won` },
  {
    key: "dailyTaskCompletion",
    label: "Daily tasks completed",
    description: "Points × (daily tasks completed ÷ daily tasks assigned). Not applied on days without daily tasks.",
    kind: "ratio",
    defaultPoints: 10,
    measure: (m) => (m.dailyTasksAssigned > 0 ? m.dailyTasksCompleted / m.dailyTasksAssigned : null),
    display: (m) => (m.dailyTasksAssigned > 0 ? `${m.dailyTasksCompleted}/${m.dailyTasksAssigned}` : "none assigned"),
  },
  { key: "dailyReportSubmitted", label: "Daily report submitted", description: "Points when the agent submits their end-of-day report.", kind: "flag", defaultPoints: 5, measure: (m) => (m.reportSubmitted ? 1 : 0), display: (m) => (m.reportSubmitted ? "submitted" : "not submitted") },
  {
    key: "taskCompletionSpeed",
    label: "Task completion speed",
    description: "Full points when tasks completed that day took ≤ 24h on average (creation → completion), scaled down linearly to 0 at 72h.",
    kind: "speed",
    defaultPoints: 5,
    measure: (m) => (m.avgTaskCompletionHours == null ? null : Math.max(0, Math.min(1, (72 - m.avgTaskCompletionHours) / 48))),
    display: (m) => (m.avgTaskCompletionHours == null ? "no tasks completed" : `avg ${m.avgTaskCompletionHours.toFixed(1)}h`),
  },
];

export const SCORE_METRIC_KEYS = SCORE_METRICS.map((m) => m.key);

export interface ScoringRuleValue {
  points: number;
  isEnabled: boolean;
}

export type ScoringRules = Record<string, ScoringRuleValue>;

export const DEFAULT_SCORING_RULES: ScoringRules = Object.fromEntries(SCORE_METRICS.map((m) => [m.key, { points: m.defaultPoints, isEnabled: true }]));

export interface ScoreItem {
  key: string;
  label: string;
  kind: MetricKind;
  value: string;
  /** Raw measure (count, or 0…1 for ratio/speed/flag), null when not applicable. */
  measure: number | null;
  weight: number;
  points: number;
  explanation: string;
}

export interface ScoreResult {
  total: number;
  items: ScoreItem[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Pure function: the same metrics and rules always give the same, explainable score. */
export function computeScore(metrics: DailyMetrics, rules: ScoringRules = DEFAULT_SCORING_RULES): ScoreResult {
  const items: ScoreItem[] = [];
  for (const metric of SCORE_METRICS) {
    const rule = rules[metric.key] ?? { points: metric.defaultPoints, isEnabled: true };
    if (!rule.isEnabled) continue;
    const measure = metric.measure(metrics);
    const points = measure == null ? 0 : round1(rule.points * measure);
    const explanation =
      measure == null ? "Not applicable"
      : metric.kind === "count" ? `${measure} × ${rule.points} pts`
      : metric.kind === "flag" ? (measure ? `+${rule.points} pts` : "0 pts")
      : `${rule.points} pts × ${pct(measure)}`;
    items.push({ key: metric.key, label: metric.label, kind: metric.kind, value: metric.display(metrics), measure, weight: rule.points, points, explanation });
  }
  return { total: round1(items.reduce((sum, i) => sum + i.points, 0)), items };
}

/** Sums several daily breakdowns into one (weekly/monthly views). */
export function sumBreakdowns(results: ScoreResult[]): ScoreResult {
  const byKey = new Map<string, ScoreItem>();
  for (const result of results) {
    for (const item of result.items) {
      const existing = byKey.get(item.key);
      if (existing) existing.points = round1(existing.points + item.points);
      else byKey.set(item.key, { ...item, value: "", explanation: "Sum of daily points" });
    }
  }
  const items = [...byKey.values()];
  return { total: round1(items.reduce((s, i) => s + i.points, 0)), items };
}

export const EMPTY_METRICS: DailyMetrics = {
  callsMade: 0,
  leadsReceived: 0,
  leadsAnswered: 0,
  leadsConverted: 0,
  propertiesPosted: 0,
  propertiesReposted: 0,
  newListings: 0,
  viewingsCompleted: 0,
  followUpsCompleted: 0,
  qualificationsDone: 0,
  tasksCompleted: 0,
  tasksOutstanding: 0,
  tasksOverdue: 0,
  dailyTasksAssigned: 0,
  dailyTasksCompleted: 0,
  avgLeadResponseMinutes: null,
  avgTaskCompletionHours: null,
  reportSubmitted: false,
};
