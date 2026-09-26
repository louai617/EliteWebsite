"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createTaskAction, updateTaskAction } from "@/actions/tasks";
import { useFormAction } from "@/hooks/use-action";
import { PRIORITY_META, TASK_STATUS_META, options } from "@/lib/constants";
import { toDateTimeInput, zonedDayStart } from "@/lib/format";
import { taskSchema, type TaskInput } from "@/schemas/task";
import type { ActionResult } from "@/types/action";
import type { AgentOption, Viewer } from "@/types/options";
import type { LookupOption } from "@/types/search";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet } from "@/components/shared/form-sheet";
import { AgentField } from "@/components/shared/form/agent-field";
import { EntityField, SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

type TaskValues = z.output<typeof taskSchema>;

export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: TaskInput["status"];
  priority: TaskInput["priority"];
  dueDate: Date | null;
  assigneeId: string | null;
  leadId: string | null;
  clientId: string | null;
  propertyId: string | null;
  dealId: string | null;
  lead?: { id: string; fullName: string } | null;
  client?: { id: string; fullName: string } | null;
  property?: { id: string; reference: string } | null;
  deal?: { id: string; reference: string } | null;
}

export interface TaskPrefill {
  leadId?: string;
  clientId?: string;
  propertyId?: string;
  dealId?: string;
  leadOption?: LookupOption | null;
  clientOption?: LookupOption | null;
  propertyOption?: LookupOption | null;
  dealOption?: LookupOption | null;
}

/** Tomorrow 10:00 Doha time. */
function defaultDue() {
  return new Date(zonedDayStart(1).getTime() + 10 * 3_600_000);
}

function TaskForm({ task, prefill, agents, viewer, onSaved }: { task?: TaskRecord; prefill?: TaskPrefill; agents: AgentOption[]; viewer: Viewer; onSaved: () => void }) {
  const form = useForm<TaskInput, unknown, TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "TODO",
      priority: task?.priority ?? "MEDIUM",
      dueDate: toDateTimeInput(task ? task.dueDate : defaultDue()),
      assigneeId: task ? task.assigneeId : viewer.id,
      leadId: task?.leadId ?? prefill?.leadId ?? null,
      clientId: task?.clientId ?? prefill?.clientId ?? null,
      propertyId: task?.propertyId ?? prefill?.propertyId ?? null,
      dealId: task?.dealId ?? prefill?.dealId ?? null,
    },
  });
  const submit = useFormAction(
    form,
    (values: TaskValues): Promise<ActionResult<{ id: string }>> => (task ? updateTaskAction({ ...values, id: task.id }) : createTaskAction(values)),
    { onSuccess: onSaved },
  );
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="title" label="Title" required className="sm:col-span-2" autoFocus={!task} placeholder="Call back about budget" />
          <TextareaField control={form.control} name="description" label="Description" className="sm:col-span-2" rows={3} />
          <TextField control={form.control} name="dueDate" label="Due" type="datetime-local" />
          <AgentField control={form.control} name="assigneeId" agents={agents} viewer={viewer} label="Assignee" />
          <SelectField control={form.control} name="priority" label="Priority" required options={options(PRIORITY_META)} />
          <SelectField control={form.control} name="status" label="Status" required options={options(TASK_STATUS_META)} />
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">Related to</p>
          <EntityField control={form.control} name="leadId" label="Lead" kind="lead" initialOption={task?.lead ? { id: task.lead.id, label: task.lead.fullName } : prefill?.leadOption} />
          <EntityField control={form.control} name="clientId" label="Client" kind="client" initialOption={task?.client ? { id: task.client.id, label: task.client.fullName } : prefill?.clientOption} />
          <EntityField control={form.control} name="propertyId" label="Property" kind="property" initialOption={task?.property ? { id: task.property.id, label: task.property.reference } : prefill?.propertyOption} />
          <EntityField control={form.control} name="dealId" label="Deal" kind="deal" initialOption={task?.deal ? { id: task.deal.id, label: task.deal.reference } : prefill?.dealOption} />
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {task ? "Save changes" : "Create task"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

export function TaskSheet({ open, onOpenChange, onSaved, ...props }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: () => void; task?: TaskRecord; prefill?: TaskPrefill; agents: AgentOption[]; viewer: Viewer }) {
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={props.task ? "Edit task" : "New task"}>
      <TaskForm
        {...props}
        onSaved={() => {
          onOpenChange(false);
          onSaved?.();
        }}
      />
    </FormSheet>
  );
}
