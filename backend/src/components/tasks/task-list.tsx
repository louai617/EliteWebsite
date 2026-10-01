"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckSquare, MoreHorizontal, Pencil, Play, Trash2, UserRoundCog } from "lucide-react";
import type { TaskStatus } from "@/generated/prisma/enums";
import type { TaskItem } from "@/services/tasks";
import { deleteTaskAction, reassignTaskAction, setTaskStatusAction } from "@/actions/tasks";
import { useAction } from "@/hooks/use-action";
import { PRIORITY_META, TASK_STATUS_META, TASK_TYPE_META } from "@/lib/constants";
import { formatDayLabel, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/task-utils";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmAction } from "@/components/shared/confirm-button";
import { TaskSheet } from "./task-form";

/** Progress of a counter-style daily task ("12 / 20 calls"). */
export function DailyProgress({ value, target, className }: { value: number; target: number; className?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={`${value} of ${target}`}>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={target} aria-label="Daily progress">
        <span className={cn("block h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-gold")} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular">
        {value}/{target}
      </span>
    </span>
  );
}

function TaskRow({ task, agents, viewer, compact, progress }: { task: TaskItem; agents: AgentOption[]; viewer: Viewer; compact?: boolean; progress?: number }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const status = useAction(setTaskStatusAction);
  const reassign = useAction(reassignTaskAction);
  const done = task.status === "COMPLETED";
  const cancelled = task.status === "CANCELLED";
  const overdue = isOverdue(task);
  const canEdit = viewer.isManager || task.createdById === viewer.id;
  const counter = Boolean(task.template?.activityType && task.targetCount);
  const related = [
    task.lead && { href: `/leads/${task.lead.id}`, label: task.lead.fullName },
    task.client && { href: `/clients/${task.client.id}`, label: task.client.fullName },
    task.property && { href: `/properties/${task.property.id}`, label: task.property.reference },
    task.deal && { href: `/deals/${task.deal.id}`, label: task.deal.reference },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <li className={cn("group flex items-start gap-3 px-4 py-3", overdue && "bg-rose-50/40")}>
      <Checkbox
        className="mt-0.5"
        checked={done}
        disabled={status.pending || cancelled || (counter && !done)}
        onCheckedChange={(v) => void status.run({ id: task.id, status: v ? "COMPLETED" : "TODO" })}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        title={counter && !done ? "Completes automatically when the target is reached" : undefined}
      />
      <div className="min-w-0 flex-1">
        <Link href={`/tasks/${task.id}`} className={cn("text-left text-sm font-medium hover:underline", (done || cancelled) && "text-muted-foreground line-through")}>
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {task.type !== "GENERAL" && <EnumBadge meta={TASK_TYPE_META} value={task.type} />}
          {counter && <DailyProgress value={progress ?? 0} target={task.targetCount!} />}
          {task.dueDate && (
            <span className={cn(overdue && "font-medium text-rose-600")}>
              {overdue ? "Overdue · " : ""}
              {formatDayLabel(task.dueDate)} {formatTime(task.dueDate)}
            </span>
          )}
          {!compact && <EnumBadge meta={PRIORITY_META} value={task.priority} />}
          {task.status === "IN_PROGRESS" && <EnumBadge meta={TASK_STATUS_META} value={task.status} />}
          {related.map((r) => (
            <Link key={r.href} href={r.href} className="hover:text-foreground hover:underline">
              {r.label}
            </Link>
          ))}
          {!compact && task.assignedBy && task.assignedBy.id !== task.assigneeId && <span>Assigned by {task.assignedBy.name}</span>}
        </div>
      </div>
      {!compact && (
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <UserAvatar user={task.assignee} className="size-5" />
          <span className="max-w-28 truncate">{task.assignee?.name ?? "Unassigned"}</span>
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label={`Actions for ${task.title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {task.status === "TODO" && (
            <DropdownMenuItem onSelect={() => void status.run({ id: task.id, status: "IN_PROGRESS" })}>
              <Play /> Start
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil /> Edit
            </DropdownMenuItem>
          )}
          {viewer.isManager && !done && !cancelled && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserRoundCog /> Reassign
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                <DropdownMenuRadioGroup value={task.assigneeId ?? ""} onValueChange={(v) => void reassign.run({ id: task.id, assigneeId: v || null, note: "" })}>
                  {agents.map((a) => (
                    <DropdownMenuRadioItem key={a.id} value={a.id}>
                      {a.id === viewer.id ? `${a.name} (me)` : a.name}
                    </DropdownMenuRadioItem>
                  ))}
                  <DropdownMenuRadioItem value="">Unassigned</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CheckSquare /> Status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={task.status} onValueChange={(v) => void status.run({ id: task.id, status: v as TaskStatus })}>
                {(Object.keys(TASK_STATUS_META) as TaskStatus[]).map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {TASK_STATUS_META[s].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canEdit && <TaskSheet open={editing} onOpenChange={setEditing} task={task} agents={agents} viewer={viewer} />}
      <ConfirmAction open={confirm} onOpenChange={setConfirm} title="Delete this task?" description={`“${task.title}” will be removed permanently.`} action={deleteTaskAction} input={{ id: task.id }} />
    </li>
  );
}

export function TaskList({
  tasks,
  agents,
  viewer,
  compact = false,
  emptyTitle = "No tasks",
  emptyDescription,
  progress,
}: {
  tasks: TaskItem[];
  agents: AgentOption[];
  viewer: Viewer;
  compact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Daily-task progress by task id. */
  progress?: Record<string, number>;
}) {
  if (tasks.length === 0) return <EmptyState compact={compact} icon={CheckSquare} title={emptyTitle} description={emptyDescription} />;
  return (
    <ul className="divide-y">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} agents={agents} viewer={viewer} compact={compact} progress={progress?.[task.id]} />
      ))}
    </ul>
  );
}
