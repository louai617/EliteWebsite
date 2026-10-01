import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { businessDate, isBusinessDate, shiftDate } from "@/lib/business-day";
import { formatDateTime } from "@/lib/format";
import { WORK_ACTIVITY_META } from "@/lib/constants";
import { getDailyReport } from "@/services/daily";
import { listWorkActivities } from "@/services/work-activities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { InfoList } from "@/components/shared/info-list";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ScoreBreakdown } from "@/components/reports/score-breakdown";

export const metadata: Metadata = { title: "Daily report" };

/** One agent's report for one business day: counters, score explanation, summary and the work behind it. */
export default async function DailyReportPage({ params }: PageProps<"/reports/[agentId]/[date]">) {
  const user = await requireUser();
  const { agentId, date } = await params;
  const today = businessDate();
  if (!isBusinessDate(date) || date > today) notFound();
  const agent = await db.user.findFirst({ where: { id: agentId, role: { not: "CLIENT" } }, select: { id: true, name: true } });
  if (!agent) notFound();
  let report;
  try {
    report = await getDailyReport(user, agentId, date);
  } catch {
    notFound();
  }
  const activities = await listWorkActivities(user, { agentId, from: date, to: date }, 1, 200);

  const nav = (d: string) => `/reports/${agentId}/${d}`;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Reports", href: "/reports" }, { label: agent.name }, { label: date }]}
        title={`${agent.name} · ${date === today ? "Today" : date}`}
        description={report.status === "FINALIZED" ? `Final — closed ${report.finalizedAt ? formatDateTime(report.finalizedAt) : ""}` : "Live — updates as work is logged"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={nav(shiftDate(date, -1))}>Previous day</Link>
            </Button>
            {date < today && (
              <Button variant="outline" asChild>
                <Link href={nav(shiftDate(date, 1))}>Next day</Link>
              </Button>
            )}
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoList
                columns={3}
                items={[
                  { label: "Calls made", value: report.callsMade },
                  { label: "Leads received", value: report.leadsReceived },
                  { label: "Leads answered", value: report.leadsAnswered },
                  { label: "Leads converted", value: report.leadsConverted },
                  { label: "Leads qualified", value: report.qualificationsDone },
                  { label: "Follow-ups", value: report.followUpsCompleted },
                  { label: "Properties posted", value: report.propertiesPosted },
                  { label: "Properties reposted", value: report.propertiesReposted },
                  { label: "New listings", value: report.newListings },
                  { label: "Viewings completed", value: report.viewingsCompleted },
                  { label: "Tasks completed", value: report.tasksCompleted },
                  { label: "Outstanding tasks", value: report.tasksOutstanding },
                  { label: "Overdue tasks", value: report.tasksOverdue },
                  { label: "Daily tasks", value: `${report.dailyTasksCompleted} / ${report.dailyTasksAssigned}` },
                  { label: "Avg. lead response", value: report.avgLeadResponseMinutes != null ? `${report.avgLeadResponseMinutes} min` : null },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>End-of-day report</CardTitle>
              {report.submittedAt && <span className="text-xs text-muted-foreground">Submitted {formatDateTime(report.submittedAt)}</span>}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {report.summary ? <p className="whitespace-pre-wrap">{report.summary}</p> : <p className="text-muted-foreground">Not submitted.</p>}
              {report.blockers && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Blockers</p>
                  <p className="whitespace-pre-wrap">{report.blockers}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Logged work</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No work recorded on this day.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {activities.items.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <EnumBadge meta={WORK_ACTIVITY_META} value={a.type} />
                      {a.lead && <Link href={`/leads/${a.lead.id}`} className="hover:underline">{a.lead.fullName}</Link>}
                      {a.client && <Link href={`/clients/${a.client.id}`} className="hover:underline">{a.client.fullName}</Link>}
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
            <CardTitle>Score</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreBreakdown breakdown={report.breakdown} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
