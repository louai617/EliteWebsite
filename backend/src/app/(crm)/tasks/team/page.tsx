import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { Priority, TaskStatus, TaskType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { enumParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { ROLE_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { TASK_SORTS, countTasks, listTasks, teamWorkload, type TaskFilters } from "@/services/tasks";
import { dailyProgress } from "@/services/work-activities";
import { listAssignableUsers } from "@/services/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TaskList } from "@/components/tasks/task-list";
import { TasksToolbar } from "@/components/tasks/tasks-toolbar";
import { TasksNav } from "@/components/tasks/tasks-nav";
import { CreateTaskButton } from "@/components/tasks/create-task-button";

export const metadata: Metadata = { title: "Team tasks" };

function tabFilters(tab: string | undefined): TaskFilters {
  switch (tab) {
    case "overdue":
      return { due: "overdue" };
    case "today":
      return { due: "today", open: true };
    case "week":
      return { due: "week", open: true };
    case "done":
      return { status: "COMPLETED" };
    case "all":
      return {};
    default:
      return { open: true };
  }
}

/** Team tasks (managers/admins): workload per agent plus every task in the team. */
export default async function TeamTasksPage({ searchParams }: PageProps<"/tasks/team">) {
  const user = await requireUser();
  if (!hasPermission(user, "tasks.viewTeam")) forbidden();
  const sp = await searchParams;
  const tab = param(sp, "tab");
  const params = listParams(sp, TASK_SORTS, { sort: tab === "done" ? "updatedAt" : "dueDate", dir: tab === "done" ? "desc" : "asc" });
  const viewer = toViewer(user);
  const shared: TaskFilters = { priority: enumParam(sp, "priority", Priority), type: enumParam(sp, "type", TaskType), assigneeId: param(sp, "assignee") };
  const filters: TaskFilters = { ...tabFilters(tab), ...shared, ...(tab === "all" ? { status: enumParam(sp, "status", TaskStatus) } : {}) };
  const count = (f: TaskFilters) => countTasks(user, params.q, { ...f, ...shared });

  const [result, agents, workload, open, overdue, today, week] = await Promise.all([
    listTasks(user, params, filters),
    listAssignableUsers(),
    teamWorkload(user),
    count({ open: true }),
    count({ due: "overdue" }),
    count({ due: "today", open: true }),
    count({ due: "week", open: true }),
  ]);
  const progress = Object.fromEntries(await dailyProgress(result.items));
  const selected = param(sp, "assignee");

  return (
    <>
      <PageHeader title="Team tasks" description="Assign work, track progress and catch overdue tasks across the team" actions={<CreateTaskButton agents={agents} viewer={viewer} openFromUrl />}>
        <TasksNav viewer={viewer} />
      </PageHeader>

      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Workload</CardTitle>
          {workload.unassigned > 0 && (
            <Link href="/tasks/team?assignee=none" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              {workload.unassigned} unassigned open task{workload.unassigned === 1 ? "" : "s"}
            </Link>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Team member</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">In progress</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Due today</TableHead>
                <TableHead className="text-right">Done today</TableHead>
                <TableHead className="text-right">Done this week</TableHead>
                <TableHead className="pr-4 text-right">On time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workload.rows.map((r) => (
                <TableRow key={r.user.id} className={cn(selected === r.user.id && "bg-secondary/60")}>
                  <TableCell className="pl-4">
                    <Link href={`/tasks/team?assignee=${r.user.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <UserAvatar user={r.user} className="size-6" />
                      {r.user.name}
                      <span className="text-xs font-normal text-muted-foreground">{ROLE_META[r.user.role].label}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="tabular text-right">{r.open}</TableCell>
                  <TableCell className="tabular text-right">{r.inProgress}</TableCell>
                  <TableCell className={cn("tabular text-right", r.overdue > 0 && "font-medium text-rose-600")}>
                    {r.overdue > 0 ? <Link href={`/tasks/team?assignee=${r.user.id}&tab=overdue`} className="hover:underline">{r.overdue}</Link> : 0}
                  </TableCell>
                  <TableCell className="tabular text-right">{r.dueToday}</TableCell>
                  <TableCell className="tabular text-right">{r.completedToday}</TableCell>
                  <TableCell className="tabular text-right">{r.completedWeek}</TableCell>
                  <TableCell className="tabular pr-4 text-right">{r.onTimeRate === null ? "—" : `${r.onTimeRate}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {workload.rows.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No active agents yet.</p>}
        </CardContent>
      </Card>

      <TasksToolbar agents={agents} viewer={viewer} counts={{ "": open, overdue, today, week }} showAssignee />
      <Card className="overflow-hidden">
        <TaskList
          tasks={result.items}
          agents={agents}
          viewer={viewer}
          progress={progress}
          emptyTitle={tab === "overdue" ? "Nothing overdue" : "No tasks match"}
          emptyDescription={tab === "overdue" ? "The team is on track." : "Try another filter, or create a task."}
        />
      </Card>
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
