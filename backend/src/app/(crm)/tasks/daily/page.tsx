import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { atLocalHour, businessDate, isBusinessDate } from "@/lib/business-day";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listTasks, type TaskItem } from "@/services/tasks";
import { dailyProgress } from "@/services/work-activities";
import { generateDailyTasks, listDailyTemplates } from "@/services/daily";
import { listAssignableUsers } from "@/services/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { DayStepper } from "@/components/shared/date-controls";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TaskList } from "@/components/tasks/task-list";
import { TasksNav } from "@/components/tasks/tasks-nav";
import { DailyTemplateList, NewDailyTemplateButton } from "@/components/tasks/daily-templates";
import { LogActivityButton } from "@/components/activities/log-activity";

export const metadata: Metadata = { title: "Daily tasks" };

/**
 * Daily tasks: the recurring work generated for each business day. Agents see their own
 * list; managers see the whole team, per-agent progress and the templates that drive it.
 * Past days stay browsable — the daily reset never deletes anything.
 */
export default async function DailyTasksPage({ searchParams }: PageProps<"/tasks/daily">) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = businessDate();
  const raw = param(sp, "date");
  const date = raw && isBusinessDate(raw) && raw <= today ? raw : today;
  const viewer = toViewer(user);
  const team = hasPermission(user, "tasks.viewTeam");
  const manageTemplates = hasPermission(user, "tasks.manageTemplates");
  const assignee = team ? param(sp, "assignee") : undefined;

  // Lazily make sure today's tasks exist (idempotent; the scheduler normally does this at midnight).
  if (date === today) await generateDailyTasks(today);

  const [result, agents, templates] = await Promise.all([
    listTasks(user, { page: 1, pageSize: 500, sort: "dueDate", dir: "asc" }, { dailyDate: date, mine: !team, assigneeId: assignee }),
    listAssignableUsers(),
    manageTemplates ? listDailyTemplates(user) : Promise.resolve([]),
  ]);
  const tasks = result.items;
  const progress = Object.fromEntries(await dailyProgress(tasks));

  const byAgent = new Map<string, { user: NonNullable<TaskItem["assignee"]>; total: number; done: number }>();
  for (const t of tasks) {
    if (!t.assignee) continue;
    const row = byAgent.get(t.assignee.id) ?? { user: t.assignee, total: 0, done: 0 };
    row.total++;
    if (t.status === "COMPLETED") row.done++;
    byAgent.set(t.assignee.id, row);
  }
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const isToday = date === today;

  return (
    <>
      <PageHeader
        title="Daily tasks"
        description={isToday ? "Today's recurring work. Counter tasks complete themselves as you log activity." : `Daily tasks for ${formatDate(atLocalHour(date, 12))} (history)`}
        actions={isToday ? <LogActivityButton viewer={viewer} agents={agents} /> : undefined}
      >
        <TasksNav viewer={viewer} />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DayStepper date={date} today={today} />
        <p className="text-sm text-muted-foreground">
          <span className="tabular font-medium text-foreground">{done}</span> of <span className="tabular">{tasks.length}</span> completed
        </p>
      </div>

      {team && byAgent.size > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...byAgent.values()].map((r) => {
            const pct = Math.round((r.done / Math.max(1, r.total)) * 100);
            const active = assignee === r.user.id;
            return (
              <Link
                key={r.user.id}
                href={active ? `/tasks/daily${isToday ? "" : `?date=${date}`}` : `/tasks/daily?assignee=${r.user.id}${isToday ? "" : `&date=${date}`}`}
                className={cn("rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(20,16,10,0.04)] hover:border-foreground/20", active && "border-gold")}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <UserAvatar user={r.user} className="size-6" />
                  <span className="truncate">{r.user.name}</span>
                  <span className="tabular ml-auto text-xs text-muted-foreground">
                    {r.done}/{r.total}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.user.name} progress`}>
                  <div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-gold")} style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Card className="overflow-hidden">
        <TaskList
          tasks={tasks}
          agents={agents}
          viewer={viewer}
          progress={progress}
          emptyTitle={isToday ? "No daily tasks today" : "No daily tasks on this day"}
          emptyDescription={manageTemplates ? "Set up recurring tasks below." : isToday ? "Your manager hasn't set up daily tasks yet." : undefined}
        />
      </Card>

      {manageTemplates && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Recurring daily tasks</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Generated every business day at midnight; editing a task applies from today.</p>
            </div>
            <NewDailyTemplateButton agents={agents} viewer={viewer} />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <DailyTemplateList templates={templates} agents={agents} viewer={viewer} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
