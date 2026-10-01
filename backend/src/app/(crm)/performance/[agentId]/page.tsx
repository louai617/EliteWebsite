import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { AlertTriangle, CalendarCheck, CheckCircle2, Gauge, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { param } from "@/lib/list-params";
import { businessDate, resolveRange, RANGE_PRESET_LABELS } from "@/lib/business-day";
import { PRIORITY_META, TASK_STATUS_META, TASK_TYPE_META, WORK_ACTIVITY_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { agentPerformance } from "@/services/performance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { RangePicker } from "@/components/shared/date-controls";
import { Toolbar } from "@/components/shared/data-table/toolbar";
import { ColumnChart } from "@/components/dashboard/charts";
import { ScoreBreakdown } from "@/components/reports/score-breakdown";

export const metadata: Metadata = { title: "Agent performance" };

const fmt = (n: number | null | undefined) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));

export default async function AgentPerformancePage({ params, searchParams }: PageProps<"/performance/[agentId]">) {
  const user = await requireUser();
  const { agentId } = await params;
  const sp = await searchParams;
  if (agentId !== user.id && !hasPermission(user, "performance.viewTeam")) forbidden();
  const today = businessDate();
  const range = resolveRange(param(sp, "range") ?? "week", { from: param(sp, "from"), to: param(sp, "to") });
  let data;
  try {
    data = await agentPerformance(user, agentId, range);
  } catch {
    notFound();
  }
  const { agent, summary, breakdown, trend, overdueTasks, missedDaily, recent, days } = data;
  const periodLabel = range.preset === "custom" ? `${range.from} → ${range.to}` : RANGE_PRESET_LABELS[range.preset];
  // Columns can't go below zero; the tooltip still shows the real (possibly negative) score.
  const points = trend.map((t) => ({
    key: t.date,
    label: t.date.slice(8),
    value: Math.max(0, t.score ?? 0),
    details: [t.score == null ? "No report" : `Score ${fmt(t.score)}`, t.date],
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={hasPermission(user, "performance.viewTeam") ? [{ label: "Performance", href: "/performance" }, { label: agent.name }] : undefined}
        title={agent.id === user.id ? "My performance" : agent.name}
        description={`${periodLabel} · scores are recalculated live today and frozen at midnight`}
      />
      <Toolbar>
        <RangePicker range={range} today={today} />
      </Toolbar>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Score" value={fmt(summary?.score ?? 0)} icon={Trophy} accent hint={`${summary?.days ?? 0} day(s)`} />
        <StatCard label="Average per day" value={fmt(summary && summary.days ? summary.score / summary.days : 0)} icon={Gauge} />
        <StatCard label="Tasks completed" value={summary?.totals.tasksCompleted ?? 0} icon={CheckCircle2} hint={summary?.avgTaskCompletionHours != null ? `avg ${fmt(summary.avgTaskCompletionHours)}h to complete` : undefined} />
        <StatCard label="Overdue now" value={overdueTasks.length} icon={AlertTriangle} hint={`${missedDaily.length} missed daily task(s) in period`} />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Daily score · last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <ColumnChart points={points} caption={`Daily score for ${agent.name}`} valueLabel="points" height={180} />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Overdue tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {overdueTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing overdue.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {overdueTasks.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                      <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                      {t.type !== "GENERAL" && <EnumBadge meta={TASK_TYPE_META} value={t.type} />}
                      <EnumBadge meta={PRIORITY_META} value={t.priority} />
                      <span className="ml-auto text-xs text-rose-600">Due {t.dueDate ? formatDateTime(t.dueDate) : "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Missed daily tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {missedDaily.length === 0 ? (
                <p className="text-sm text-muted-foreground">No missed daily tasks in this period.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {missedDaily.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 py-2">
                      <Link href={`/tasks/${t.id}`} className="hover:underline">{t.title}</Link>
                      <EnumBadge meta={TASK_STATUS_META} value={t.status} />
                      <span className="ml-auto text-xs text-muted-foreground">{t.dailyDate}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Days</CardTitle>
            </CardHeader>
            <CardContent>
              {days.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports in this period.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {days.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-2">
                      <CalendarCheck className="size-4 text-muted-foreground" />
                      <Link href={`/reports/${agent.id}/${d.date}`} className="font-medium hover:underline">{d.date === today ? "Today" : d.date}</Link>
                      <span className="text-xs text-muted-foreground">
                        {d.callsMade} calls · {d.leadsAnswered} answered · {d.viewingsCompleted} viewings · {d.tasksCompleted} tasks
                      </span>
                      <span className="tabular ml-auto font-semibold">{fmt(d.score)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent work</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No work logged in this period.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {recent.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <EnumBadge meta={WORK_ACTIVITY_META} value={a.type} />
                      {a.lead && <Link href={`/leads/${a.lead.id}`} className="hover:underline">{a.lead.fullName}</Link>}
                      {a.property && <Link href={`/properties/${a.property.id}`} className="hover:underline">{a.property.reference}</Link>}
                      {a.outcome && <span className="text-muted-foreground">{a.outcome}</span>}
                      <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(a.occurredAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-sm">Score breakdown · {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreBreakdown breakdown={breakdown} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
