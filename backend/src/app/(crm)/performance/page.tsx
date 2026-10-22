import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { param } from "@/lib/list-params";
import { businessDate, resolveRange, RANGE_PRESET_LABELS } from "@/lib/business-day";
import { SCORE_METRICS } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { performanceBoard } from "@/services/performance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RangePicker } from "@/components/shared/date-controls";
import { Toolbar } from "@/components/shared/data-table/toolbar";
import { ScoreBreakdown } from "@/components/reports/score-breakdown";
import { ScoringRulesForm } from "@/components/performance/scoring-rules-form";

export const metadata: Metadata = { title: "Performance" };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Team leaderboard. The period score is the sum of daily scores, each explained by its breakdown. */
export default async function PerformancePage({ searchParams }: PageProps<"/performance">) {
  const user = await requireUser();
  const sp = await searchParams;
  const rangeParam = param(sp, "range") ?? "week";
  if (!hasPermission(user, "performance.viewTeam")) {
    const qs = new URLSearchParams(Object.entries({ range: rangeParam, from: param(sp, "from"), to: param(sp, "to") }).filter((e): e is [string, string] => Boolean(e[1])));
    redirect(`/performance/${user.id}?${qs}`);
  }
  const today = businessDate();
  const range = resolveRange(rangeParam, { from: param(sp, "from"), to: param(sp, "to") });
  const board = await performanceBoard(user, range);
  const rangeQs = `range=${range.preset}${range.preset === "custom" ? `&from=${range.from}&to=${range.to}` : ""}`;
  const metrics = SCORE_METRICS.map(({ key, label, description, kind, defaultPoints }) => ({ key, label, description, kind, defaultPoints }));

  return (
    <>
      <PageHeader title="Performance" description={`Agent scores for ${range.preset === "custom" ? `${range.from} → ${range.to}` : RANGE_PRESET_LABELS[range.preset].toLowerCase()} — every point is explained below`} />
      <Toolbar>
        <RangePicker range={range} today={today} />
      </Toolbar>

      <Card className="mb-4 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          {board.agents.length === 0 ? (
            <EmptyState compact icon={Trophy} title="No scores in this period" description="Scores appear as soon as agents log work." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-4">#</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Avg / day</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Leads answered</TableHead>
                  <TableHead className="text-right">Viewings</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Tasks done</TableHead>
                  <TableHead className="text-right">Overdue now</TableHead>
                  <TableHead className="pr-4 text-right">Reports</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {board.agents.map((a, i) => (
                  <TableRow key={a.agent.id}>
                    <TableCell className={cn("tabular pl-4 font-semibold", i === 0 && "text-gold")}>{i + 1}</TableCell>
                    <TableCell>
                      <Link href={`/performance/${a.agent.id}?${rangeQs}`} className="flex items-center gap-2 font-medium hover:underline">
                        <UserAvatar user={a.agent} className="size-6" />
                        {a.agent.name}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">{fmt(a.score)}</TableCell>
                    <TableCell className="tabular text-right">{fmt(a.avgDailyScore)}</TableCell>
                    <TableCell className="tabular text-right">{a.totals.callsMade}</TableCell>
                    <TableCell className="tabular text-right">
                      {a.totals.leadsAnswered}/{a.totals.leadsReceived}
                    </TableCell>
                    <TableCell className="tabular text-right">{a.totals.viewingsCompleted}</TableCell>
                    <TableCell className="tabular text-right">{a.totals.leadsConverted}</TableCell>
                    <TableCell className="tabular text-right">{a.totals.tasksCompleted}</TableCell>
                    <TableCell className={cn("tabular text-right", a.overdueNow > 0 && "font-medium text-rose-600")}>{a.overdueNow}</TableCell>
                    <TableCell className="tabular pr-4 text-right text-muted-foreground">
                      {a.submitted}/{a.days}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {board.agents.length > 0 && (
        <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {board.agents.map((a) => (
            <Card key={a.agent.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <UserAvatar user={a.agent} className="size-6" />
                  {a.agent.name}
                </CardTitle>
                <Link href={`/performance/${a.agent.id}?${rangeQs}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                  Details
                </Link>
              </CardHeader>
              <CardContent>
                <ScoreBreakdown breakdown={a.breakdown} compact />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex-col">
          <CardTitle className="text-sm">How the score works</CardTitle>
          <p className="text-xs text-muted-foreground">Each day, every metric below adds (or subtracts) points. The period score is the sum of the daily scores.</p>
        </CardHeader>
        <CardContent>
          <ScoringRulesForm metrics={metrics} rules={board.rules} editable={hasPermission(user, "performance.configure")} />
        </CardContent>
      </Card>
    </>
  );
}
