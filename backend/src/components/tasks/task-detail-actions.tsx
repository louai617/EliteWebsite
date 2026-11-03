"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import type { TaskStatus } from "@/generated/prisma/enums";
import { addTaskNoteAction, deleteTaskAction, reassignTaskAction, setTaskStatusAction } from "@/actions/tasks";
import { useAction } from "@/hooks/use-action";
import type { TaskDetail } from "@/services/tasks";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmAction } from "@/components/shared/confirm-button";
import { TaskSheet } from "./task-form";

const UNASSIGNED = "__none__";

/** Status buttons, edit and delete for the task page header. */
export function TaskHeaderActions({ task, agents, viewer }: { task: TaskDetail; agents: AgentOption[]; viewer: Viewer }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const status = useAction(setTaskStatusAction);
  const counter = Boolean(task.template?.activityType && task.targetCount);
  const open = task.status === "TODO" || task.status === "IN_PROGRESS";
  const set = (s: TaskStatus) => void status.run({ id: task.id, status: s });

  return (
    <div className="flex flex-wrap gap-2">
      {task.status === "TODO" && (
        <Button variant="outline" onClick={() => set("IN_PROGRESS")} disabled={status.pending}>
          <Play /> Start
        </Button>
      )}
      {open && !counter && (
        <Button onClick={() => set("COMPLETED")} disabled={status.pending}>
          <CheckCircle2 /> Complete
        </Button>
      )}
      {open && task.canEdit && (
        <Button variant="outline" onClick={() => set("CANCELLED")} disabled={status.pending}>
          <Ban /> Cancel task
        </Button>
      )}
      {!open && (
        <Button variant="outline" onClick={() => set("TODO")} disabled={status.pending}>
          <RotateCcw /> Reopen
        </Button>
      )}
      {task.canEdit && (
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
      )}
      {task.canDelete && (
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
          <Trash2 /> Delete
        </Button>
      )}
      {task.canEdit && <TaskSheet open={editing} onOpenChange={setEditing} task={task} agents={agents} viewer={viewer} />}
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this task?"
        description={`“${task.title}” and its history will be removed permanently.`}
        action={deleteTaskAction}
        input={{ id: task.id }}
        onDone={() => router.push("/tasks")}
      />
    </div>
  );
}

/** Managers move a task to another team member; the change is kept in the task history. */
export function ReassignTask({ task, agents, viewer }: { task: TaskDetail; agents: AgentOption[]; viewer: Viewer }) {
  const [assignee, setAssignee] = useState(task.assigneeId ?? UNASSIGNED);
  const [note, setNote] = useState("");
  const reassign = useAction(reassignTaskAction, { onSuccess: () => setNote("") });
  const changed = assignee !== (task.assigneeId ?? UNASSIGNED);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) void reassign.run({ id: task.id, assigneeId: assignee === UNASSIGNED ? null : assignee, note });
      }}
    >
      <Select value={assignee} onValueChange={setAssignee}>
        <SelectTrigger className="w-full" aria-label="Assignee">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.id === viewer.id ? `${a.name} (me)` : a.name}
            </SelectItem>
          ))}
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        </SelectContent>
      </Select>
      {changed && <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="Reason (optional)" aria-label="Reason for reassigning" />}
      <Button type="submit" size="sm" variant="outline" disabled={!changed} loading={reassign.pending}>
        Reassign
      </Button>
    </form>
  );
}

export function TaskNoteForm({ taskId }: { taskId: string }) {
  const [message, setMessage] = useState("");
  const add = useAction(addTaskNoteAction, { onSuccess: () => setMessage("") });
  const value = message.trim();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.length >= 1) void add.run({ id: taskId, message: value });
      }}
    >
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} placeholder="Add a progress note…" aria-label="Note" />
      <Button type="submit" size="sm" disabled={!value} loading={add.pending}>
        Add note
      </Button>
    </form>
  );
}
