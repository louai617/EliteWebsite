import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { TaskStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { toViewer } from "@/lib/viewer";
import { PRIORITY_META, TASK_STATUS_META, TASK_TYPE_META, WORK_ACTIVITY_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getTask, type TaskDetail } from "@/services/tasks";
import { dailyProgress } from "@/services/work-activities";
import { listAssignableUsers } from "@/services/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { InfoList } from "@/components/shared/info-list";
import { AgentCell, UserAvatar } from "@/components/shared/user-avatar";
import { RelativeTime } from "@/components/shared/relative-time";
import { DailyProgress } from "@/components/tasks/task-list";
import { isOverdue } from "@/lib/task-utils";
import { ReassignTask, TaskHeaderActions, TaskNoteForm } from "@/components/tasks/task-detail-actions";

export const metadata: Metadata = { title: "Task" };

function duration(from: Date | null, to: Date | null) {
  if (!from || !to) return null;
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours < 48 ? `${Math.round(hours * 10) / 10} h` : `${Math.round((hours / 24) * 10) / 10} days`;
}

const statusLabel = (v: string | null) => (v && v in TASK_STATUS_META ? TASK_STATUS_META[v as TaskStatus].label : (v ?? "—"));

function describe(e: TaskDetail["events"][number]) {
  switch (e.type) {
    case "CREATED":
      return "created the task";
    case "ASSIGNED":
      return `assigned it to ${e.toValue ?? "nobody"}`;
    case "REASSIGNED":
      return `reassigned it from ${e.fromValue ?? "Unassigned"} to ${e.toValue ?? "Unassigned"}`;
    case "STATUS_CHANGED":
      return `changed status from ${statusLabel(e.fromValue)} to ${statusLabel(e.toValue)}`;
    case "PRIORITY_CHANGED":
      return `changed priority from ${e.fromValue} to ${e.toValue}`;
    case "DUE_DATE_CHANGED":
      return `changed the due date from ${e.fromValue ?? "none"} to ${e.toValue ?? "none"}`;
    case "UPDATED":
      return "updated the details";
    case "NOTE":
      return "added a note";
  }
}

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const task = await getTask(user, id);
  if (!task) notFound();
  const viewer = toViewer(user);
  const [agents, progressMap] = await Promise.all([listAssignableUsers(), dailyProgress([task])]);
  const overdue = isOverdue(task);
  const counter = Boolean(task.template?.activityType && task.targetCount);

  const related = [
    task.lead && { label: "Lead", href: `/leads/${task.lead.id}`, text: task.lead.fullName },
    task.client && { label: "Client", href: `/clients/${task.client.id}`, text: task.client.fullName },
    task.property && { label: "Property", href: `/properties/${task.property.id}`, text: task.property.reference },
    task.deal && { label: "Deal", href: `/deals/${task.deal.id}`, text: task.deal.reference },
    task.viewing && { label: "Viewing", href: "/viewings", text: formatDateTime(task.viewing.startsAt) },
  ].filter(Boolean) as { label: string; href: string; text: string }[];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Tasks", href: "/tasks" }, { label: task.title }]}
        title={task.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <EnumBadge meta={TASK_STATUS_META} value={task.status} dot />
            <EnumBadge meta={PRIORITY_META} value={task.priority} />
            {task.type !== "GENERAL" && <EnumBadge meta={TASK_TYPE_META} value={task.type} />}
            {task.dailyDate && <span>Daily task · {task.dailyDate}</span>}
            {overdue && <span className="font-medium text-rose-600">Overdue</span>}
          </span>
        }
        actions={<TaskHeaderActions task={task} agents={agents} viewer={viewer} />}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.description && <p className="rounded-md bg-muted/60 p-3 text-sm whitespace-pre-wrap">{task.description}</p>}
              {counter && (
                <div className="text-sm">
                  <p className="mb-1 text-xs text-muted-foreground">Progress</p>
                  <DailyProgress value={progressMap.get(task.id) ?? 0} target={task.targetCount!} />
                  <p className="mt-1 text-xs text-muted-foreground">Completes automatically when {task.targetCount} × {WORK_ACTIVITY_META[task.template!.activityType!].label.toLowerCase()} are logged.</p>
                </div>
              )}
              <InfoList
                items={[
                  { label: "Due", value: task.dueDate && <span className={cn(overdue && "font-medium text-rose-600")}>{formatDateTime(task.dueDate)}</span> },
                  { label: "Assignee", value: <AgentCell agent={task.assignee} /> },
                  { label: "Created by", value: task.createdBy?.name ?? "System" },
                  { label: "Assigned by", value: task.assignedBy?.name },
                  { label: "Created", value: formatDateTime(task.createdAt) },
                  { label: "Started", value: task.startedAt && formatDateTime(task.startedAt) },
                  { label: "Completed", value: task.completedAt && formatDateTime(task.completedAt) },
                  { label: "Time to complete", value: duration(task.startedAt ?? task.createdAt, task.completedAt) },
                  { label: "Last updated", value: <RelativeTime date={task.updatedAt} /> },
                  { label: "Visible to client", value: task.clientVisible ? "Yes" : "No", hidden: !task.clientId },
                ]}
              />
              {related.length > 0 && (
                <InfoList items={related.map((r) => ({ label: r.label, value: <Link href={r.href} className="hover:underline">{r.text}</Link> }))} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {task.events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <UserAvatar user={e.actor ?? { name: "System" }} className="mt-0.5 size-6" />
                    <div className="min-w-0 text-sm">
                      <p>
                        <span className="font-medium">{e.actor?.name ?? "System"}</span> <span className="text-muted-foreground">{describe(e)}</span>
                      </p>
                      {e.message && <p className="mt-1 rounded-md bg-muted/60 px-3 py-2 whitespace-pre-wrap">{e.message}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Add note</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskNoteForm taskId={task.id} />
            </CardContent>
          </Card>
          {task.canReassign && (
            <Card>
              <CardHeader>
                <CardTitle>Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <ReassignTask task={task} agents={agents} viewer={viewer} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Recorded work</CardTitle>
            </CardHeader>
            <CardContent>
              {task.workActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing recorded yet. Completing this task records it for the daily report.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {task.workActivities.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <EnumBadge meta={WORK_ACTIVITY_META} value={a.type} />
                      <span className="text-xs text-muted-foreground">
                        {a.agent.name} · {formatDateTime(a.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
