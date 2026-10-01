import "server-only";
import { db } from "@/lib/db";
import { businessDate, datesBetween, shiftDate, type DateRange } from "@/lib/business-day";
import { forbidden, notFound } from "@/lib/errors";
import { hasPermission, isStaff, type Actor } from "@/lib/permissions";
import { sumBreakdowns, type ScoreResult } from "@/lib/scoring";
import { parseBreakdown, reportRows, summarize } from "./daily";
import { getScoringRules } from "./scoring";

/**
 * Performance views built on the daily reports: a period's score is the sum of its daily
 * scores, and its breakdown is the sum of the daily breakdowns — so weekly and monthly
 * numbers are explained exactly like a single day.
 */

export async function performanceBoard(actor: Actor, range: DateRange) {
  if (!isStaff(actor)) throw forbidden();
  const rows = await reportRows(actor, range);
  const summary = summarize(rows);
  const now = new Date();
  const overdueNow = await db.task.groupBy({ by: ["assigneeId"], where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: now } }, _count: { _all: true } });
  const overdue = new Map(overdueNow.map((r) => [r.assigneeId, r._count._all]));
  const breakdowns = new Map<string, ScoreResult[]>();
  for (const row of rows) {
    const b = parseBreakdown(row);
    if (b) breakdowns.set(row.agentId, [...(breakdowns.get(row.agentId) ?? []), b]);
  }
  return {
    range,
    agents: summary.agents.map((a) => ({
      ...a,
      avgDailyScore: a.days ? Math.round((a.score / a.days) * 10) / 10 : 0,
      overdueNow: overdue.get(a.agent.id) ?? 0,
      breakdown: sumBreakdowns(breakdowns.get(a.agent.id) ?? []),
    })),
    team: summary.team,
    rules: await getScoringRules(),
  };
}

export type PerformanceBoard = Awaited<ReturnType<typeof performanceBoard>>;

/** One agent: score trend, breakdown for the range, missed work and recent activity. */
export async function agentPerformance(actor: Actor, agentId: string, range: DateRange, trendDays = 30) {
  if (!isStaff(actor)) throw forbidden();
  if (agentId !== actor.id && !hasPermission(actor, "performance.viewTeam")) throw forbidden("You can only see your own performance.");
  const agent = await db.user.findFirst({ where: { id: agentId, role: { not: "CLIENT" } }, select: { id: true, name: true, role: true, avatarUrl: true, email: true } });
  if (!agent) throw notFound("Agent");

  const today = businessDate();
  const trendFrom = shiftDate(today, -(trendDays - 1));
  const [rangeRows, trendRows, overdueTasks, missedDaily, recent] = await Promise.all([
    reportRows(actor, range, agentId),
    reportRows(actor, { preset: "custom", from: trendFrom, to: today }, agentId),
    db.task.findMany({
      where: { assigneeId: agentId, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: new Date() } },
      orderBy: { dueDate: "asc" },
      take: 20,
      select: { id: true, title: true, type: true, dueDate: true, priority: true },
    }),
    db.task.findMany({
      where: { assigneeId: agentId, dailyDate: { gte: range.from, lte: range.to, lt: today }, status: { not: "COMPLETED" } },
      orderBy: { dailyDate: "desc" },
      take: 30,
      select: { id: true, title: true, dailyDate: true, status: true, targetCount: true },
    }),
    db.agentActivity.findMany({
      where: { agentId, businessDate: { gte: range.from, lte: range.to } },
      orderBy: { occurredAt: "desc" },
      take: 30,
      select: { id: true, type: true, occurredAt: true, source: true, outcome: true, lead: { select: { id: true, fullName: true } }, property: { select: { id: true, reference: true } } },
    }),
  ]);
  const byDate = new Map(trendRows.map((r) => [r.date, r.score ?? 0]));
  const trend = datesBetween(trendFrom, today).map((date) => ({ date, score: byDate.has(date) ? byDate.get(date)! : null }));
  const breakdown = sumBreakdowns(rangeRows.map((r) => parseBreakdown(r)).filter((b): b is ScoreResult => Boolean(b)));
  const summary = summarize(rangeRows).agents[0] ?? null;
  return { agent, range, summary, breakdown, days: rangeRows, trend, overdueTasks, missedDaily, recent };
}

export type AgentPerformance = Awaited<ReturnType<typeof agentPerformance>>;
