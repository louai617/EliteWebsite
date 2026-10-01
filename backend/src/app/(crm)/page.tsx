import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, CheckSquare, Handshake, Percent, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { toViewer } from "@/lib/viewer";
import { LEAD_STATUS_META } from "@/lib/constants";
import { formatDayLabel, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatTime, formatZoned, zonedNow } from "@/lib/format";
import { dashboardStats, teamPerformance } from "@/services/dashboard";
import { recentActivity } from "@/services/activity";
import { upcomingViewings } from "@/services/viewings";
import { focusTasks } from "@/services/tasks";
import { refreshOpenReport } from "@/services/daily";
import { listAssignableUsers } from "@/services/users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VIEWING_STATUS_META } from "@/lib/constants";
import { BarList, ColumnChart } from "@/components/dashboard/charts";
import { TaskList } from "@/components/tasks/task-list";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(date: { getHours(): number }) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0 && current === 0) return <span>No change {label}</span>;
  if (previous === 0) return <span>New this month</span>;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5">
      <Icon className={up ? "size-3.5 text-emerald-600" : "size-3.5 text-rose-600"} aria-hidden />
      <span className={up ? "text-emerald-700" : "text-rose-700"}>{`${up ? "+" : ""}${pct.toFixed(0)}%`}</span>&nbsp;{label}
    </span>
  );
}

function Metric({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="group min-w-0 px-4 py-3 transition-colors hover:bg-muted/40">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold group-hover:underline">{formatNumber(value)}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const viewer = toViewer(user);
  const [stats, activity, viewings, tasks, agents, team, today] = await Promise.all([
    dashboardStats(user),
    recentActivity(user, 10),
    upcomingViewings(user, 6),
    focusTasks(user, 8),
    listAssignableUsers(),
    teamPerformance(user),
    refreshOpenReport(user.id),
  ]);
  const now = zonedNow();
  const monthCommission = stats.deals.commissionPerMonth.at(-1)?.value ?? 0;

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${user.name.split(" ")[0]}`}
        description={`${formatZoned(now, "EEEE d MMMM yyyy")} · ${viewer.isManager ? "Team overview" : "Your pipeline"}`}
      />

      {/* Headline figures */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pipeline value"
          value={formatMoneyCompact(stats.deals.pipelineValue)}
          icon={TrendingUp}
          accent
          href="/deals?status=open"
          hint={`${stats.deals.active} active deals · ${formatMoneyCompact(stats.deals.pipelineCommission)} expected commission`}
        />
        <StatCard
          label="Commission earned"
          value={formatMoneyCompact(stats.deals.wonCommission)}
          icon={Wallet}
          href="/deals?status=CLOSED_WON"
          hint={`${formatMoneyCompact(monthCommission)} this month · ${formatMoneyCompact(stats.deals.wonValue)} closed`}
        />
        <StatCard
          label="Leads this month"
          value={formatNumber(stats.leads.thisMonth)}
          icon={UsersRound}
          href="/leads?view=table"
          hint={<Delta current={stats.leads.thisMonth} previous={stats.leads.lastMonth} label="vs last month" />}
        />
        <StatCard
          label="Lead conversion"
          value={formatPercent(stats.leads.conversionRate, 1)}
          icon={Percent}
          href="/leads?view=table&status=WON"
          hint={`${stats.leads.won} won of ${stats.leads.total} leads · ${stats.leads.lost} lost`}
        />
      </div>

      {/* Today's work (daily report, live) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Today&apos;s work</CardTitle>
            <CardDescription>Live counters from your logged activity — the day closes at midnight and is kept as history.</CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/tasks/daily" className="text-muted-foreground hover:text-foreground hover:underline">
              Daily tasks {today.dailyTasksCompleted}/{today.dailyTasksAssigned}
            </Link>
            <Link href={`/reports/${user.id}/${today.date}`} className="font-medium hover:underline">
              Score {Number.isInteger(today.score ?? 0) ? (today.score ?? 0) : (today.score ?? 0).toFixed(1)} <ArrowRight className="inline size-3" />
            </Link>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 divide-x divide-y border-t sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <Metric label="Calls" value={today.callsMade} href="/reports" />
          <Metric label="Leads answered" value={today.leadsAnswered} href="/leads?status=CONTACTED" />
          <Metric label="Follow-ups" value={today.followUpsCompleted} href="/reports" />
          <Metric label="Posted / reposted" value={today.propertiesPosted + today.propertiesReposted} href="/properties" />
          <Metric label="Viewings" value={today.viewingsCompleted} href="/viewings" />
          <Metric label="Tasks completed" value={today.tasksCompleted} href="/tasks?tab=done" />
        </div>
      </Card>

      {/* Inventory & pipeline counts */}
      <Card className="mt-3 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0 lg:grid-cols-8">
          <Metric label={viewer.isManager ? "Total properties" : "My listings"} value={stats.properties.total} href="/properties" />
          <Metric label="Available" value={stats.properties.available} href="/properties?status=AVAILABLE" />
          <Metric label="Rented" value={stats.properties.rented} href="/properties?status=RENTED" />
          <Metric label="Sold" value={stats.properties.sold} href="/properties?status=SOLD" />
          <Metric label="Total leads" value={stats.leads.total} href="/leads?view=table" />
          <Metric label="New leads" value={stats.leads.new} href="/leads?view=table&status=NEW" />
          <Metric label="Active deals" value={stats.deals.active} href="/deals?status=open" />
          <Metric label="Closed deals" value={stats.deals.closedWon} href="/deals?status=CLOSED_WON" />
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Commission by month</CardTitle>
              <CardDescription>Closed-won deals, last 6 months</CardDescription>
            </div>
            <span className="tabular text-sm font-semibold">{formatMoney(stats.deals.commissionPerMonth.reduce((s, m) => s + m.value, 0))}</span>
          </CardHeader>
          <CardContent>
            <ColumnChart
              points={stats.deals.commissionPerMonth.map((m) => ({
                key: m.key,
                label: m.label,
                value: m.value,
                details: [`${m.deals} deal${m.deals === 1 ? "" : "s"} · ${formatMoneyCompact(m.dealValue)} value`],
              }))}
              format="money"
              valueLabel="commission"
              caption="Commission from closed-won deals per month (QAR)"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Lead pipeline</CardTitle>
              <CardDescription>Leads in each stage</CardDescription>
            </div>
            <Link href="/leads" className="text-xs text-muted-foreground hover:text-foreground">
              Board <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <BarList
              rows={stats.leads.pipeline.map((p) => ({ key: p.status, label: LEAD_STATUS_META[p.status].label, value: p.value, href: `/leads?view=table&status=${p.status}` }))}
              valueLabel="leads"
              caption="Leads by pipeline stage"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Today&apos;s tasks{viewer.isManager ? " · team" : ""}</CardTitle>
              <CardDescription>
                {stats.tasks.dueToday} due today
                {stats.tasks.overdue > 0 && <span className="text-rose-600"> · {stats.tasks.overdue} overdue</span>}
              </CardDescription>
            </div>
            <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground">
              All tasks <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <div className="border-t">
            <TaskList tasks={tasks} agents={agents} viewer={viewer} compact emptyTitle="Nothing due today" emptyDescription="Overdue and today's tasks show up here." />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Upcoming viewings</CardTitle>
              <CardDescription>{stats.viewings.next7Days} in the next 7 days</CardDescription>
            </div>
            <Link href="/viewings" className="text-xs text-muted-foreground hover:text-foreground">
              Calendar <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {viewings.length === 0 ? (
              <EmptyState compact icon={CalendarClock} title="No upcoming viewings" />
            ) : (
              <ul className="divide-y">
                {viewings.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="w-16 shrink-0">
                      <p className="text-xs font-medium">{formatDayLabel(v.startsAt)}</p>
                      <p className="tabular text-xs text-muted-foreground">{formatTime(v.startsAt)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/properties/${v.property.id}`} className="line-clamp-1 text-[13px] font-medium hover:underline">
                        {v.property.reference} · {v.property.area}
                      </Link>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {v.lead?.fullName ?? v.client?.fullName ?? "—"} · {v.agent?.name ?? "No agent"}
                      </p>
                    </div>
                    <EnumBadge meta={VIEWING_STATUS_META} value={v.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>{viewer.isManager ? "Across the team" : "On your records"}</CardDescription>
            </div>
            <Link href="/activity" className="text-xs text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <ActivityTimeline items={activity} showEntity />
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>New leads by month</CardTitle>
              <CardDescription>Last 6 months</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ColumnChart
              points={stats.leads.perMonth.map((m) => ({ key: m.key, label: m.label, value: m.value }))}
              format="count"
              valueLabel="leads"
              caption="New leads per month"
              height={180}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Lead sources</CardTitle>
              <CardDescription>All-time, by channel</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {stats.leads.sources.length === 0 ? (
              <EmptyState compact icon={UsersRound} title="No leads yet" />
            ) : (
              <BarList
                rows={stats.leads.sources.map((s) => ({ key: s.source, label: s.label, value: s.value, href: `/leads?view=table&source=${s.source}` }))}
                valueLabel="leads"
                caption="Leads by source"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {viewer.isManager && (
        <Card className="mt-5 overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Team performance</CardTitle>
              <CardDescription>All-time closed commission and current pipeline per agent</CardDescription>
            </div>
            <Handshake className="size-4 text-muted-foreground" />
          </CardHeader>
          {team.length === 0 ? (
            <CardContent>
              <EmptyState compact icon={CheckSquare} title="No agents yet" />
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Active leads</TableHead>
                  <TableHead className="text-right">Viewings done</TableHead>
                  <TableHead className="text-right">Open deals</TableHead>
                  <TableHead className="text-right">Pipeline</TableHead>
                  <TableHead className="text-right">Won deals</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <UserAvatar user={a} />
                        <span className="text-[13px] font-medium">{a.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-right">{a.activeLeads}</TableCell>
                    <TableCell className="tabular text-right">{a.viewingsDone}</TableCell>
                    <TableCell className="tabular text-right">{a.openDeals}</TableCell>
                    <TableCell className="tabular text-right">{formatMoneyCompact(a.pipeline)}</TableCell>
                    <TableCell className="tabular text-right">{a.wonDeals}</TableCell>
                    <TableCell className="tabular text-right font-medium">{formatMoney(a.commission)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
