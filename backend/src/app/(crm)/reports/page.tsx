import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Eye, Megaphone, PhoneCall, Repeat, Target, UserCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { param } from "@/lib/list-params";
import { businessDate, resolveRange, RANGE_PRESET_LABELS } from "@/lib/business-day";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDailyReport, reportRows, summarize } from "@/services/daily";
import { listAssignableUsers } from "@/services/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RangePicker } from "@/components/shared/date-controls";
import { FilterSelect, Toolbar } from "@/components/shared/data-table/toolbar";
import { DailyReportForm } from "@/components/reports/daily-report-form";

export const metadata: Metadata = { title: "Reports" };

const COLUMNS = [
  { key: "callsMade", label: "Calls" },
  { key: "leadsReceived", label: "Leads in" },
  { key: "leadsAnswered", label: "Answered" },
  { key: "leadsConverted", label: "Converted" },
  { key: "propertiesPosted", label: "Posted" },
  { key: "propertiesReposted", label: "Reposted" },
  { key: "viewingsCompleted", label: "Viewings" },
  { key: "followUpsCompleted", label: "Follow-ups" },
  { key: "tasksCompleted", label: "Tasks done" },
  { key: "tasksOutstanding", label: "Outstanding" },
] as const;

const fmtScore = (n: number | null | undefined) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Daily activity reports for TODAY / YESTERDAY / THIS WEEK / THIS MONTH / CUSTOM.
 * History comes from finalized (frozen) daily reports; today's numbers are live.
 */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = businessDate();
  const range = resolveRange(param(sp, "range"), { from: param(sp, "from"), to: param(sp, "to") });
  const team = hasPermission(user, "reports.viewTeam");
  const agentId = team ? param(sp, "agent") : user.id;

  const [rows, agents, mine] = await Promise.all([reportRows(user, range, agentId), team ? listAssignableUsers() : Promise.resolve([]), getDailyReport(user, user.id, today)]);
  const summary = summarize(rows);
  const t = summary.team;
  const single = range.from === range.to;
  const periodLabel = range.preset === "custom" ? `${range.from} → ${range.to}` : RANGE_PRESET_LABELS[range.preset];

  return (
    <>
      <PageHeader title="Reports" description={team ? "Daily activity across the team — history is kept for every day" : "Your daily activity and end-of-day reports"} />

      <Toolbar>
        <RangePicker range={range} today={today} />
        {team && (
          <FilterSelect param="agent" label="Agent" options={agents.map((a) => ({ value: a.id, label: a.id === user.id ? `${a.name} (me)` : a.name }))} />
        )}
      </Toolbar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Calls made" value={formatNumber(t.callsMade)} icon={PhoneCall} hint={periodLabel} />
        <StatCard label="Leads received / answered" value={`${formatNumber(t.leadsReceived)} / ${formatNumber(t.leadsAnswered)}`} icon={UserCheck} hint={`${formatNumber(t.leadsConverted)} converted`} />
        <StatCard label="Properties posted / reposted" value={`${formatNumber(t.propertiesPosted)} / ${formatNumber(t.propertiesReposted)}`} icon={Megaphone} hint={`${formatNumber(t.newListings)} new listings`} />
        <StatCard label="Viewings completed" value={formatNumber(t.viewingsCompleted)} icon={Eye} hint={`${formatNumber(t.followUpsCompleted)} follow-ups`} />
        <StatCard label="Tasks completed" value={formatNumber(t.tasksCompleted)} icon={CheckCircle2} hint={`${formatNumber(t.dailyTasksCompleted)} of ${formatNumber(t.dailyTasksAssigned)} daily tasks`} />
        <StatCard label="Outstanding tasks" value={formatNumber(t.tasksOutstanding)} icon={ClipboardList} hint={`${formatNumber(t.tasksOverdue)} overdue (latest day)`} />
        <StatCard label="Qualified leads" value={formatNumber(t.qualificationsDone)} icon={Target} />
        <StatCard label="Reports submitted" value={formatNumber(summary.agents.reduce((s, a) => s + a.submitted, 0))} icon={Repeat} hint={`of ${formatNumber(rows.length)} agent-days`} />
      </div>

      {team && !single && summary.agents.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">By agent · {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Agent</TableHead>
                  {COLUMNS.map((c) => (
                    <TableHead key={c.key} className="text-right">
                      {c.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="pr-4 text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.agents.map((a) => (
                  <TableRow key={a.agent.id}>
                    <TableCell className="pl-4">
                      <Link href={`/performance/${a.agent.id}?range=${range.preset}${range.preset === "custom" ? `&from=${range.from}&to=${range.to}` : ""}`} className="flex items-center gap-2 font-medium hover:underline">
                        <UserAvatar user={a.agent} className="size-6" />
                        {a.agent.name}
                      </Link>
                    </TableCell>
                    {COLUMNS.map((c) => (
                      <TableCell key={c.key} className="tabular text-right">
                        {formatNumber(a.totals[c.key] ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell className="tabular text-right text-muted-foreground">{a.days}</TableCell>
                    <TableCell className="tabular pr-4 text-right font-semibold">{fmtScore(a.score)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Daily reports</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0 pb-0">
            {rows.length === 0 ? (
              <EmptyState compact icon={ClipboardList} title="No reports in this period" description="Reports are created automatically every day for each active agent." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Date</TableHead>
                    {(team || !agentId) && <TableHead>Agent</TableHead>}
                    {COLUMNS.map((c) => (
                      <TableHead key={c.key} className="text-right">
                        {c.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4 whitespace-nowrap">
                        <Link href={`/reports/${r.agentId}/${r.date}`} className="font-medium hover:underline">
                          {r.date === today ? "Today" : r.date}
                        </Link>
                      </TableCell>
                      {(team || !agentId) && (
                        <TableCell className="whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <UserAvatar user={r.agent} className="size-5" />
                            {r.agent.name}
                          </span>
                        </TableCell>
                      )}
                      {COLUMNS.map((c) => (
                        <TableCell key={c.key} className="tabular text-right">
                          {r[c.key]}
                        </TableCell>
                      ))}
                      <TableCell className="tabular text-right font-semibold">{fmtScore(r.score)}</TableCell>
                      <TableCell className="pr-4 text-xs whitespace-nowrap">
                        <span className={cn("rounded px-1.5 py-0.5", r.status === "FINALIZED" ? "bg-secondary text-muted-foreground" : "bg-blue-50 text-blue-700")}>{r.status === "FINALIZED" ? "Final" : "Live"}</span>
                        {r.submittedAt && <span className="ml-1.5 text-emerald-700">Submitted</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">My report for today</CardTitle>
            <span className="text-xs text-muted-foreground">Score so far: {fmtScore(mine.score)}</span>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">Your counters fill in automatically from your activity. Add a short summary before the end of the day — the day closes at midnight and is kept as history.</p>
            <DailyReportForm summary={mine.summary} blockers={mine.blockers} submitted={Boolean(mine.submittedAt)} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
