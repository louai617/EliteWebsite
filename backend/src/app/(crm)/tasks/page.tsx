import type { Metadata } from "next";
import { Priority, TaskStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { enumParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { TASK_SORTS, countTasks, listTasks, type TaskFilters } from "@/services/tasks";
import { listAssignableUsers } from "@/services/users";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { TaskList } from "@/components/tasks/task-list";
import { TasksToolbar } from "@/components/tasks/tasks-toolbar";
import { CreateTaskButton } from "@/components/tasks/create-task-button";

export const metadata: Metadata = { title: "Tasks" };

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

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = param(sp, "tab");
  const params = listParams(sp, TASK_SORTS, { sort: tab === "done" ? "updatedAt" : "dueDate", dir: tab === "done" ? "desc" : "asc" });
  const viewer = toViewer(user);
  const shared: TaskFilters = {
    priority: enumParam(sp, "priority", Priority),
    assigneeId: param(sp, "assignee"),
  };
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

  return (
    <>
      <PageHeader title="Tasks" description={viewer.isManager ? "Follow-ups across the team" : "Your follow-ups and to-dos"} actions={<CreateTaskButton agents={agents} viewer={viewer} openFromUrl />} />
      <TasksToolbar agents={agents} viewer={viewer} counts={{ "": open, overdue, today, week }} />
      <Card className="overflow-hidden">
        <TaskList
          tasks={result.items}
          agents={agents}
          viewer={viewer}
          emptyTitle={tab === "overdue" ? "Nothing overdue" : tab === "done" ? "No completed tasks yet" : "No tasks here"}
          emptyDescription={tab === "overdue" ? "You're all caught up." : undefined}
        />
      </Card>
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
