"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { TaskStatus } from "@/generated/prisma/enums";
import type { TaskItem } from "@/services/tasks";
import { deleteTaskAction, setTaskStatusAction } from "@/actions/tasks";
import { useAction } from "@/hooks/use-action";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/constants";
import { formatDayLabel, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmAction } from "@/components/shared/confirm-button";
import { TaskSheet } from "./task-form";

export function isOverdue(task: { dueDate: Date | null; status: TaskStatus }) {
  return Boolean(task.dueDate && new Date(task.dueDate).getTime() < Date.now() && (task.status === "TODO" || task.status === "IN_PROGRESS"));
}

function TaskRow({ task, agents, viewer, compact }: { task: TaskItem; agents: AgentOption[]; viewer: Viewer; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const status = useAction(setTaskStatusAction);
  const done = task.status === "COMPLETED";
  const cancelled = task.status === "CANCELLED";
  const overdue = isOverdue(task);
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
        disabled={status.pending || cancelled}
        onCheckedChange={(v) => void status.run({ id: task.id, status: v ? "COMPLETED" : "TODO" })}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
      />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => setEditing(true)} className={cn("text-left text-sm font-medium hover:underline", (done || cancelled) && "text-muted-foreground line-through")}>
          {task.title}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TaskSheet open={editing} onOpenChange={setEditing} task={task} agents={agents} viewer={viewer} />
      <ConfirmAction open={confirm} onOpenChange={setConfirm} title="Delete this task?" description={`“${task.title}” will be removed permanently.`} action={deleteTaskAction} input={{ id: task.id }} />
    </li>
  );
}

export function TaskList({ tasks, agents, viewer, compact = false, emptyTitle = "No tasks", emptyDescription }: { tasks: TaskItem[]; agents: AgentOption[]; viewer: Viewer; compact?: boolean; emptyTitle?: string; emptyDescription?: string }) {
  if (tasks.length === 0) return <EmptyState compact={compact} icon={CheckSquare} title={emptyTitle} description={emptyDescription} />;
  return (
    <ul className="divide-y">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} agents={agents} viewer={viewer} compact={compact} />
      ))}
    </ul>
  );
}
