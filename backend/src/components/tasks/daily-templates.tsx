"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CalendarClock, MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { createDailyTemplateAction, deleteDailyTemplateAction, updateDailyTemplateAction } from "@/actions/daily";
import { useAction, useFormAction } from "@/hooks/use-action";
import { PRIORITY_META, TASK_TYPE_META, WORK_ACTIVITY_META, options } from "@/lib/constants";
import { dailyTemplateSchema, type DailyTemplateInput } from "@/schemas/daily";
import type { DailyTemplateItem } from "@/services/daily";
import type { AgentOption, Viewer } from "@/types/options";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormSheet } from "@/components/shared/form-sheet";
import { AgentField } from "@/components/shared/form/agent-field";
import { CheckboxField, SelectField, TextField, TextareaField } from "@/components/shared/form/fields";
import { ConfirmAction } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";

type Values = z.output<typeof dailyTemplateSchema>;

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }));

function TemplateForm({ template, agents, viewer, onSaved }: { template?: DailyTemplateItem; agents: AgentOption[]; viewer: Viewer; onSaved: () => void }) {
  const form = useForm<DailyTemplateInput, unknown, Values>({
    resolver: zodResolver(dailyTemplateSchema),
    defaultValues: {
      title: template?.title ?? "",
      description: template?.description ?? "",
      taskType: template?.taskType ?? "GENERAL",
      activityType: template?.activityType ?? "",
      targetCount: String(template?.targetCount ?? 1),
      priority: template?.priority ?? "MEDIUM",
      dueHour: String(template?.dueHour ?? 18),
      isActive: template?.isActive ?? true,
      assigneeId: template?.assigneeId ?? null,
    },
  });
  const submit = useFormAction(form, (values: Values) => (template ? updateDailyTemplateAction({ ...values, id: template.id }) : createDailyTemplateAction(values)), { onSuccess: onSaved });
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="title" label="Title" required placeholder="Make 20 calls" className="sm:col-span-2" />
          <TextareaField control={form.control} name="description" label="Instructions" rows={3} className="sm:col-span-2" />
          <SelectField control={form.control} name="taskType" label="Task type" options={options(TASK_TYPE_META)} />
          <SelectField control={form.control} name="priority" label="Priority" options={options(PRIORITY_META)} />
          <SelectField
            control={form.control}
            name="activityType"
            label="Counts activity"
            options={options(WORK_ACTIVITY_META)}
            allowEmpty
            emptyLabel="None — ticked off manually"
            description="When set, the task completes itself once the agent logs the target number of these activities."
            className="sm:col-span-2"
          />
          <TextField control={form.control} name="targetCount" label="Daily target" inputMode="numeric" />
          <SelectField control={form.control} name="dueHour" label="Due by" options={HOURS} />
          <AgentField control={form.control} name="assigneeId" agents={agents} viewer={viewer} label="Assign to" className="sm:col-span-2" />
          <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">Leave “Unassigned” to give the task to every active agent each day.</p>
          <CheckboxField control={form.control} name="isActive" label="Active — generate this task every day" className="sm:col-span-2" />
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {template ? "Save" : "Create daily task"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

function TemplateRow({ template, agents, viewer }: { template: DailyTemplateItem; agents: AgentOption[]; viewer: Viewer }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toggle = useAction(updateDailyTemplateAction);
  const t = template;
  return (
    <li className={cn("flex items-start gap-3 px-4 py-3", !t.isActive && "opacity-60")}>
      <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {t.taskType !== "GENERAL" && <EnumBadge meta={TASK_TYPE_META} value={t.taskType} />}
          <EnumBadge meta={PRIORITY_META} value={t.priority} />
          <span>{t.activityType ? `${t.targetCount} × ${WORK_ACTIVITY_META[t.activityType].label.toLowerCase()}` : "Manual check-off"}</span>
          <span>Due {String(t.dueHour).padStart(2, "0")}:00</span>
          <span>{t.assignee ? t.assignee.name : "All agents"}</span>
          {!t.isActive && <span className="font-medium">Paused</span>}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label={`Actions for ${t.title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={toggle.pending}
            onSelect={() =>
              void toggle.run({
                id: t.id, title: t.title, description: t.description ?? "", taskType: t.taskType, activityType: t.activityType ?? "",
                targetCount: String(t.targetCount), priority: t.priority, dueHour: String(t.dueHour), isActive: !t.isActive, assigneeId: t.assigneeId,
              })
            }
          >
            <Power /> {t.isActive ? "Pause" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FormSheet open={editing} onOpenChange={setEditing} title="Edit daily task">
        <TemplateForm template={t} agents={agents} viewer={viewer} onSaved={() => setEditing(false)} />
      </FormSheet>
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this daily task?"
        description="It will no longer be generated. Tasks it already created stay in the history."
        action={deleteDailyTemplateAction}
        input={{ id: t.id }}
      />
    </li>
  );
}

export function NewDailyTemplateButton({ agents, viewer }: { agents: AgentOption[]; viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus /> New daily task
      </Button>
      <FormSheet open={open} onOpenChange={setOpen} title="New daily task" description="Generated for the team every business day; applies to today immediately.">
        <TemplateForm agents={agents} viewer={viewer} onSaved={() => setOpen(false)} />
      </FormSheet>
    </>
  );
}

export function DailyTemplateList({ templates, agents, viewer }: { templates: DailyTemplateItem[]; agents: AgentOption[]; viewer: Viewer }) {
  if (templates.length === 0) return <EmptyState compact icon={CalendarClock} title="No daily tasks set up" description="Create recurring tasks such as “Make 20 calls” or “Repost 5 listings”." />;
  return (
    <ul className="divide-y">
      {templates.map((t) => (
        <TemplateRow key={t.id} template={t} agents={agents} viewer={viewer} />
      ))}
    </ul>
  );
}
