import type { Metadata } from "next";
import { Priority, TaskStatus, TaskType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { enumParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { TASK_SORTS, countTasks, listTasks, type TaskFilters } from "@/services/tasks";
import { dailyProgress } from "@/services/work-activities";
import { listAssignableUsers } from "@/services/users";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { TaskList } from "@/components/tasks/task-list";
import { TasksToolbar } from "@/components/tasks/tasks-toolbar";
import { TasksNav } from "@/components/tasks/tasks-nav";
import { CreateTaskButton } from "@/components/tasks/create-task-button";
import { LogActivityButton } from "@/components/activities/log-activity";

export const metadata: Metadata = { title: "My tasks" };

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

/** My tasks: everything assigned to the signed-in user, including today's daily tasks. */
export default async function MyTasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = param(sp, "tab");
  const params = listParams(sp, TASK_SORTS, { sort: tab === "done" ? "updatedAt" : "dueDate", dir: tab === "done" ? "desc" : "asc" });
  const viewer = toViewer(user);
  const shared: TaskFilters = { mine: true, priority: enumParam(sp, "priority", Priority), type: enumParam(sp, "type", TaskType) };
  const filters: TaskFilters = { ...tabFilters(tab), ...shared, ...(tab === "all" ? { status: enumParam(sp, "status", TaskStatus) } : {}) };
  const count = (f: TaskFilters) => countTasks(user, params.q, { ...f, ...shared });

  const [result, agents, open, overdue, today, week] = await Promise.all([
    listTasks(user, params, filters),
    listAssignableUsers(),
    count({ open: true }),
    count({ due: "overdue" }),
    count({ due: "today", open: true }),
    count({ due: "week", open: true }),
  ]);
  const progress = Object.fromEntries(await dailyProgress(result.items));

  return (
    <>
      <PageHeader
        title="My tasks"
        description="Everything assigned to you — follow-ups, daily tasks and work assigned by your manager"
        actions={
          <>
            <LogActivityButton viewer={viewer} agents={agents} openFromUrl />
            <CreateTaskButton agents={agents} viewer={viewer} openFromUrl />
          </>
        }
      >
        <TasksNav viewer={viewer} />
      </PageHeader>
      <TasksToolbar agents={agents} viewer={viewer} counts={{ "": open, overdue, today, week }} />
      <Card className="overflow-hidden">
        <TaskList
          tasks={result.items}
          agents={agents}
          viewer={viewer}
          progress={progress}
          emptyTitle={tab === "overdue" ? "Nothing overdue" : tab === "done" ? "No completed tasks yet" : "No tasks here"}
          emptyDescription={tab === "overdue" ? "You're all caught up." : undefined}
        />
      </Card>
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
