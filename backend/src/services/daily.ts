import "server-only";
import type { z } from "zod";
import type { DailyReport } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { atLocalHour, businessDate, datesBetween, dayRange, shiftDate, type BusinessDate, type DateRange } from "@/lib/business-day";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { hasPermission, isStaff, type Actor } from "@/lib/permissions";
import { computeScore, type DailyMetrics, type ScoreResult } from "@/lib/scoring";
import type { dailyReportSubmitSchema, dailyTemplateSchema, updateDailyTemplateSchema } from "@/schemas/daily";
import { assertActiveUser } from "./access";
import { getScoringRules } from "./scoring";
import { progressDailyTasks } from "./work-activities";

/**
 * Daily operations: daily task templates, daily reports and the 24-hour rollover.
 *
 * The "reset" never deletes anything:
 *  - Each business day gets its own generated tasks (Task.dailyDate) — yesterday's tasks stay
 *    in history with whatever status they ended in.
 *  - Each agent gets one DailyReport per day. Today's counters are live; at rollover the
 *    day's counters and score are computed one last time and FROZEN (status FINALIZED).
 *    Finalized reports are never recomputed, so historical reports are immutable.
 * Day boundaries are midnight in the business time zone (lib/business-day.ts).
 */

const OPEN = ["TODO", "IN_PROGRESS"] as const;

// ─────────────────────────────── Templates ───────────────────────────────

export const templateSelect = {
  id: true,
  title: true,
  description: true,
  taskType: true,
  activityType: true,
  targetCount: true,
  priority: true,
  dueHour: true,
  isActive: true,
  sortOrder: true,
  assigneeId: true,
  assignee: { select: { id: true, name: true } },
  _count: { select: { tasks: true } },
} satisfies Prisma.DailyTaskTemplateSelect;

export type DailyTemplateItem = Prisma.DailyTaskTemplateGetPayload<{ select: typeof templateSelect }>;

export function listDailyTemplates(actor: Actor) {
  if (!isStaff(actor)) throw forbidden();
  return db.dailyTaskTemplate.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }], select: templateSelect });
}

function assertManage(actor: Actor) {
  if (!hasPermission(actor, "tasks.manageTemplates")) throw forbidden("Only managers can manage daily tasks.");
}

export async function createDailyTemplate(actor: Actor, input: z.output<typeof dailyTemplateSchema>) {
  assertManage(actor);
  await assertActiveUser(input.assigneeId);
  const last = await db.dailyTaskTemplate.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const template = await db.dailyTaskTemplate.create({ data: { ...input, sortOrder: (last?.sortOrder ?? 0) + 1 }, select: { id: true } });
  // Apply to today right away so the team sees it without waiting for tomorrow.
  if (input.isActive) await generateDailyTasks(businessDate(), { templateIds: [template.id] });
  return template;
}

export async function updateDailyTemplate(actor: Actor, input: z.output<typeof updateDailyTemplateSchema>) {
  assertManage(actor);
  const { id, ...data } = input;
  await assertActiveUser(data.assigneeId);
  const template = await db.dailyTaskTemplate.update({ where: { id }, data, select: { id: true } });
  if (data.isActive) await generateDailyTasks(businessDate(), { templateIds: [id] });
  return template;
}

/** Deleting a template keeps the tasks it already generated (history). */
export async function deleteDailyTemplate(actor: Actor, id: string) {
  assertManage(actor);
  await db.dailyTaskTemplate.delete({ where: { id } });
}

// ─────────────────────────────── Generation ───────────────────────────────

/** Who receives a template's tasks: the chosen user, or every active agent. */
async function templateTargets(assigneeId: string | null) {
  if (assigneeId) return db.user.findMany({ where: { id: assigneeId, isActive: true, role: { not: "CLIENT" } }, select: { id: true } });
  return db.user.findMany({ where: { isActive: true, role: "AGENT" }, select: { id: true } });
}

/**
 * Creates the day's tasks from active templates. Idempotent (Task.autoKey), so it can run
 * from the scheduler, the cron endpoint and lazily from page views without duplicates.
 */
export async function generateDailyTasks(date: BusinessDate, { templateIds, agentId }: { templateIds?: string[]; agentId?: string } = {}) {
  const templates = await db.dailyTaskTemplate.findMany({
    where: { isActive: true, ...(templateIds ? { id: { in: templateIds } } : {}), ...(agentId ? { OR: [{ assigneeId: null }, { assigneeId: agentId }] } : {}) },
    orderBy: { sortOrder: "asc" },
  });
  let created = 0;
  for (const template of templates) {
    const targets = (await templateTargets(template.assigneeId)).filter((u) => !agentId || u.id === agentId);
    for (const target of targets) {
      const autoKey = `daily:${template.id}:${target.id}:${date}`;
      const exists = await db.task.findUnique({ where: { autoKey }, select: { id: true } });
      if (exists) continue;
      try {
        await db.$transaction(async (tx) => {
          await tx.task.create({
            data: {
              title: template.targetCount > 1 && template.activityType ? `${template.title} (${template.targetCount})` : template.title,
              description: template.description,
              type: template.taskType,
              priority: template.priority,
              dueDate: atLocalHour(date, template.dueHour),
              dailyDate: date,
              templateId: template.id,
              targetCount: template.activityType ? template.targetCount : null,
              assigneeId: target.id,
              autoKey,
              events: { create: { type: "CREATED", message: `Daily task for ${date}` } },
            },
          });
          // Work logged before the task existed (e.g. early calls) still counts.
          if (template.activityType) await progressDailyTasks(tx, target.id, date, template.activityType);
        });
        created++;
      } catch (error) {
        // Another process created it first — fine, generation is idempotent.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
  }
  return created;
}

// ─────────────────────────────── Metrics ───────────────────────────────

const avg = (values: number[]) => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null);

/**
 * The day's numbers for one agent. For past days, task counts are reconstructed "as of the
 * end of that day" (open = not completed before midnight), so they are correct no matter
 * when the rollover actually runs.
 */
export async function computeDailyMetrics(agentId: string, date: BusinessDate, reportSubmitted = false): Promise<DailyMetrics> {
  const { start, end } = dayRange(date);
  const today = businessDate();
  const live = date === today;
  const now = new Date();
  const asOf = live ? now : end;

  const [activityRows, newLeads, responseTasks, completedTasks, outstanding, overdue, dailyAssigned, dailyCompleted, responses] = await Promise.all([
    db.agentActivity.groupBy({ by: ["type"], where: { agentId, businessDate: date }, _count: { _all: true } }),
    db.lead.findMany({ where: { agentId, createdAt: { gte: start, lt: end } }, select: { id: true } }),
    db.task.findMany({ where: { assigneeId: agentId, type: "LEAD_RESPONSE", createdAt: { gte: start, lt: end }, leadId: { not: null } }, select: { leadId: true } }),
    db.task.findMany({ where: { assigneeId: agentId, status: "COMPLETED", completedAt: { gte: start, lt: end } }, select: { createdAt: true, completedAt: true } }),
    db.task.count({ where: { assigneeId: agentId, createdAt: { lt: asOf }, OR: [{ status: { in: [...OPEN] } }, { status: "COMPLETED", completedAt: { gte: asOf } }] } }),
    db.task.count({ where: { assigneeId: agentId, dueDate: { lt: asOf }, createdAt: { lt: asOf }, OR: [{ status: { in: [...OPEN] } }, { status: "COMPLETED", completedAt: { gte: asOf } }] } }),
    db.task.count({ where: { assigneeId: agentId, dailyDate: date } }),
    db.task.count({ where: { assigneeId: agentId, dailyDate: date, status: "COMPLETED" } }),
    db.agentActivity.findMany({ where: { agentId, businessDate: date, type: "LEAD_RESPONSE", leadId: { not: null } }, select: { occurredAt: true, lead: { select: { createdAt: true } } } }),
  ]);
  const count = (type: string) => activityRows.find((r) => r.type === type)?._count._all ?? 0;
  const received = new Set([...newLeads.map((l) => l.id), ...responseTasks.map((t) => t.leadId!)]);

  return {
    callsMade: count("CALL"),
    leadsReceived: received.size,
    leadsAnswered: count("LEAD_RESPONSE"),
    leadsConverted: count("CONVERSION"),
    propertiesPosted: count("PROPERTY_POST"),
    propertiesReposted: count("PROPERTY_REPOST"),
    newListings: count("NEW_LISTING"),
    viewingsCompleted: count("VIEWING"),
    followUpsCompleted: count("FOLLOW_UP") + count("CLIENT_FOLLOW_UP"),
    qualificationsDone: count("LEAD_QUALIFICATION"),
    tasksCompleted: completedTasks.length,
    tasksOutstanding: outstanding,
    tasksOverdue: overdue,
    dailyTasksAssigned: dailyAssigned,
    dailyTasksCompleted: dailyCompleted,
    avgLeadResponseMinutes: avg(responses.filter((r) => r.lead).map((r) => Math.max(0, (r.occurredAt.getTime() - r.lead!.createdAt.getTime()) / 60_000))),
    avgTaskCompletionHours: avg(completedTasks.map((t) => Math.max(0, (t.completedAt!.getTime() - t.createdAt.getTime()) / 3_600_000))),
    reportSubmitted,
  };
}

const METRIC_FIELDS = [
  "callsMade", "leadsReceived", "leadsAnswered", "leadsConverted", "propertiesPosted", "propertiesReposted", "newListings",
  "viewingsCompleted", "followUpsCompleted", "qualificationsDone", "tasksCompleted", "tasksOutstanding", "tasksOverdue",
  "dailyTasksAssigned", "dailyTasksCompleted", "avgLeadResponseMinutes", "avgTaskCompletionHours",
] as const;

function metricColumns(m: DailyMetrics) {
  return Object.fromEntries(METRIC_FIELDS.map((k) => [k, m[k]])) as Pick<DailyMetrics, (typeof METRIC_FIELDS)[number]>;
}

export function metricsFromReport(report: DailyReport): DailyMetrics {
  return { ...metricColumns(report as unknown as DailyMetrics), reportSubmitted: Boolean(report.submittedAt) };
}

export function parseBreakdown(report: Pick<DailyReport, "scoreBreakdown" | "score">): ScoreResult | null {
  if (!report.scoreBreakdown) return null;
  try {
    return JSON.parse(report.scoreBreakdown) as ScoreResult;
  } catch {
    return null;
  }
}

// ─────────────────────────────── Reports ───────────────────────────────

/** Refreshes (or creates) today's OPEN report with live counters and score. Finalized rows are never touched. */
export async function refreshOpenReport(agentId: string, date: BusinessDate = businessDate()) {
  const existing = await db.dailyReport.findUnique({ where: { agentId_date: { agentId, date } } });
  if (existing?.status === "FINALIZED") return existing;
  const metrics = await computeDailyMetrics(agentId, date, Boolean(existing?.submittedAt));
  const score = computeScore(metrics, await getScoringRules());
  const data = { ...metricColumns(metrics), score: score.total, scoreBreakdown: JSON.stringify(score) };
  return db.dailyReport.upsert({ where: { agentId_date: { agentId, date } }, create: { agentId, date, ...data }, update: data });
}

/** Freezes every agent's report for a past business day. Safe to call repeatedly. */
export async function finalizeDay(date: BusinessDate) {
  if (date >= businessDate()) throw invalid("Only past days can be finalized.");
  const { end } = dayRange(date);
  const [agents, activeOnDay, openRows] = await Promise.all([
    db.user.findMany({ where: { role: "AGENT", isActive: true, createdAt: { lt: end } }, select: { id: true } }),
    db.agentActivity.findMany({ where: { businessDate: date }, distinct: ["agentId"], select: { agentId: true } }),
    db.dailyReport.findMany({ where: { date }, select: { agentId: true, status: true, submittedAt: true } }),
  ]);
  const rows = new Map(openRows.map((r) => [r.agentId, r]));
  const agentIds = new Set([...agents.map((a) => a.id), ...activeOnDay.map((a) => a.agentId), ...openRows.map((r) => r.agentId)]);
  const rules = await getScoringRules();
  let finalized = 0;
  for (const agentId of agentIds) {
    const row = rows.get(agentId);
    if (row?.status === "FINALIZED") continue;
    const metrics = await computeDailyMetrics(agentId, date, Boolean(row?.submittedAt));
    const score = computeScore(metrics, rules);
    const data = { ...metricColumns(metrics), score: score.total, scoreBreakdown: JSON.stringify(score), status: "FINALIZED" as const, finalizedAt: new Date() };
    await db.dailyReport.upsert({ where: { agentId_date: { agentId, date } }, create: { agentId, date, ...data }, update: data });
    finalized++;
  }
  return finalized;
}

/** The agent's own end-of-day report (summary + blockers). Only today's report can be submitted. */
export async function submitDailyReport(actor: Actor, input: z.output<typeof dailyReportSubmitSchema>) {
  if (!isStaff(actor)) throw forbidden();
  const date = businessDate();
  const report = await refreshOpenReport(actor.id, date);
  if (report.status === "FINALIZED") throw invalid("This day is already closed.");
  await db.dailyReport.update({ where: { id: report.id }, data: { summary: input.summary, blockers: input.blockers, submittedAt: report.submittedAt ?? new Date() } });
  return refreshOpenReport(actor.id, date);
}

function assertCanView(actor: Actor, agentId: string) {
  if (!isStaff(actor)) throw forbidden();
  if (agentId !== actor.id && !hasPermission(actor, "reports.viewTeam")) throw forbidden("You can only see your own reports.");
}

export async function getDailyReport(actor: Actor, agentId: string, date: BusinessDate) {
  assertCanView(actor, agentId);
  const today = businessDate();
  if (date > today) throw invalid("That day hasn't happened yet.");
  const report = date === today ? await refreshOpenReport(agentId, date) : await db.dailyReport.findUnique({ where: { agentId_date: { agentId, date } } });
  if (!report) throw notFound("Report");
  return { ...report, breakdown: parseBreakdown(report) };
}

/**
 * Report rows for a date range (TODAY / YESTERDAY / THIS WEEK / THIS MONTH / CUSTOM):
 * finalized history straight from the table, plus today's live numbers if today is in range.
 */
export async function reportRows(actor: Actor, range: DateRange, agentId?: string) {
  if (!isStaff(actor)) throw forbidden();
  const teamView = hasPermission(actor, "reports.viewTeam");
  const agentFilter = teamView ? agentId : actor.id;
  const today = businessDate();
  if (range.to >= today && range.from <= today) {
    const live = await db.user.findMany({
      where: { isActive: true, ...(agentFilter ? { id: agentFilter } : { role: "AGENT" }) },
      select: { id: true, role: true },
    });
    for (const user of live) if (user.role !== "CLIENT") await refreshOpenReport(user.id, today);
  }
  const rows = await db.dailyReport.findMany({
    where: { date: { gte: range.from, lte: range.to }, ...(agentFilter ? { agentId: agentFilter } : {}) },
    orderBy: [{ date: "desc" }],
    include: { agent: { select: { id: true, name: true, avatarUrl: true, role: true } } },
  });
  return rows;
}

export type ReportRow = Awaited<ReturnType<typeof reportRows>>[number];

const SUM_FIELDS = METRIC_FIELDS.filter((f) => !f.startsWith("avg"));

/** Totals per agent (and for the team) over the rows of a range. */
export function summarize(rows: ReportRow[]) {
  const byAgent = new Map<string, { agent: ReportRow["agent"]; days: number; score: number; submitted: number; totals: Record<string, number>; responseTimes: number[]; completionTimes: number[] }>();
  for (const row of rows) {
    const entry = byAgent.get(row.agentId) ?? { agent: row.agent, days: 0, score: 0, submitted: 0, totals: Object.fromEntries(SUM_FIELDS.map((f) => [f, 0])), responseTimes: [], completionTimes: [] };
    entry.days++;
    entry.score += row.score ?? 0;
    if (row.submittedAt) entry.submitted++;
    for (const f of SUM_FIELDS) {
      // Outstanding/overdue are point-in-time: use the latest day rather than a sum.
      if (f === "tasksOutstanding" || f === "tasksOverdue") continue;
      entry.totals[f] += row[f] as number;
    }
    if (row.avgLeadResponseMinutes != null) entry.responseTimes.push(row.avgLeadResponseMinutes);
    if (row.avgTaskCompletionHours != null) entry.completionTimes.push(row.avgTaskCompletionHours);
    byAgent.set(row.agentId, entry);
  }
  // Rows are newest first, so the first row per agent holds the latest point-in-time counts.
  for (const row of rows) {
    const entry = byAgent.get(row.agentId)!;
    if (entry.totals.__latest) continue;
    entry.totals.tasksOutstanding = row.tasksOutstanding;
    entry.totals.tasksOverdue = row.tasksOverdue;
    entry.totals.__latest = 1;
  }
  const agents = [...byAgent.values()]
    .map((e) => {
      const { __latest: _latest, ...totals } = e.totals;
      return { agent: e.agent, days: e.days, submitted: e.submitted, score: Math.round(e.score * 10) / 10, totals, avgLeadResponseMinutes: avg(e.responseTimes), avgTaskCompletionHours: avg(e.completionTimes) };
    })
    .sort((a, b) => b.score - a.score);
  const team = Object.fromEntries(SUM_FIELDS.map((f) => [f, agents.reduce((s, a) => s + (a.totals[f] ?? 0), 0)]));
  return { agents, team };
}

// ─────────────────────────────── Rollover ───────────────────────────────

const STALE_RUN_MS = 10 * 60_000;
const MAX_CATCH_UP_DAYS = 31;

/**
 * The daily transition. Runs every minute from the in-process scheduler (and/or the cron
 * endpoint) but does real work once per business day, guarded by a SystemJob row so several
 * server instances never double-run it:
 *   1. finalize every past day that is not finalized yet (catches up after downtime)
 *   2. generate today's daily tasks
 */
export async function runDailyRollover(now: Date = new Date()) {
  const today = businessDate(now);
  const key = `daily-rollover:${today}`;
  const job = await db.systemJob.findUnique({ where: { key } });
  if (job?.status === "DONE") return { date: today, skipped: true as const };
  if (job?.status === "RUNNING" && now.getTime() - job.startedAt.getTime() < STALE_RUN_MS) return { date: today, skipped: true as const };

  try {
    if (job) await db.systemJob.update({ where: { key }, data: { status: "RUNNING", startedAt: now, error: null } });
    else await db.systemJob.create({ data: { key, status: "RUNNING", startedAt: now } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { date: today, skipped: true as const };
    throw error;
  }

  try {
    const yesterday = shiftDate(today, -1);
    const [lastFinal, openPast] = await Promise.all([
      db.dailyReport.findFirst({ where: { status: "FINALIZED" }, orderBy: { date: "desc" }, select: { date: true } }),
      db.dailyReport.findMany({ where: { status: "OPEN", date: { lt: today } }, distinct: ["date"], select: { date: true } }),
    ]);
    const earliest = shiftDate(today, -MAX_CATCH_UP_DAYS);
    const from = lastFinal ? (shiftDate(lastFinal.date, 1) > earliest ? shiftDate(lastFinal.date, 1) : earliest) : yesterday;
    const dates = new Set<string>([...openPast.map((r) => r.date).filter((d) => d >= earliest), ...(from <= yesterday ? datesBetween(from, yesterday) : [])]);
    const finalized: Record<string, number> = {};
    for (const date of [...dates].sort()) finalized[date] = await finalizeDay(date);
    const generated = await generateDailyTasks(today);
    const details = { finalized, generated };
    await db.systemJob.update({ where: { key }, data: { status: "DONE", finishedAt: new Date(), details: JSON.stringify(details) } });
    return { date: today, skipped: false as const, ...details };
  } catch (error) {
    await db.systemJob.update({ where: { key }, data: { status: "FAILED", finishedAt: new Date(), error: String(error).slice(0, 2000) } }).catch(() => undefined);
    throw error;
  }
}

export function lastRollover() {
  return db.systemJob.findFirst({ where: { key: { startsWith: "daily-rollover:" } }, orderBy: { startedAt: "desc" } });
}
