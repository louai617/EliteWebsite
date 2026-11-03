"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { PhoneCall } from "lucide-react";
import { logWorkActivityAction } from "@/actions/work-activities";
import { useFormAction } from "@/hooks/use-action";
import { WORK_ACTIVITY_META, options } from "@/lib/constants";
import { toDateTimeInput } from "@/lib/format";
import { workActivitySchema, type WorkActivityInput } from "@/schemas/work-activity";
import type { WorkActivityType } from "@/generated/prisma/enums";
import type { AgentOption, Viewer } from "@/types/options";
import type { LookupOption } from "@/types/search";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet, useCreateParam } from "@/components/shared/form-sheet";
import { AgentField } from "@/components/shared/form/agent-field";
import { EntityField, SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

type Values = z.output<typeof workActivitySchema>;

/** Activities an agent records by hand (the rest are recorded automatically by the CRM). */
const MANUAL_TYPES: WorkActivityType[] = ["CALL", "LEAD_RESPONSE", "FOLLOW_UP", "CLIENT_FOLLOW_UP", "LEAD_QUALIFICATION", "PROPERTY_POST", "PROPERTY_REPOST", "VIEWING", "OTHER"];

export interface LogActivityPrefill {
  type?: WorkActivityType;
  leadId?: string;
  clientId?: string;
  propertyId?: string;
  taskId?: string;
  leadOption?: LookupOption | null;
  clientOption?: LookupOption | null;
  propertyOption?: LookupOption | null;
}

function LogActivityForm({ prefill, agents, viewer, onSaved }: { prefill?: LogActivityPrefill; agents?: AgentOption[]; viewer: Viewer; onSaved: () => void }) {
  const form = useForm<WorkActivityInput, unknown, Values>({
    resolver: zodResolver(workActivitySchema),
    defaultValues: {
      type: prefill?.type ?? "CALL",
      agentId: viewer.id,
      occurredAt: toDateTimeInput(new Date()),
      outcome: "",
      notes: "",
      durationMin: "",
      taskId: prefill?.taskId ?? null,
      leadId: prefill?.leadId ?? null,
      clientId: prefill?.clientId ?? null,
      propertyId: prefill?.propertyId ?? null,
      viewingId: null,
      dealId: null,
    },
  });
  const submit = useFormAction(form, (values: Values) => logWorkActivityAction(values), { onSuccess: onSaved });
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
          <SelectField control={form.control} name="type" label="What did you do?" required className="sm:col-span-2" options={options(WORK_ACTIVITY_META).filter((o) => MANUAL_TYPES.includes(o.value))} />
          <TextField control={form.control} name="occurredAt" label="When" type="datetime-local" />
          <TextField control={form.control} name="durationMin" label="Duration (min)" inputMode="numeric" />
          <TextField control={form.control} name="outcome" label="Outcome" placeholder="Interested, call back Sunday" className="sm:col-span-2" />
          <TextareaField control={form.control} name="notes" label="Notes" rows={3} className="sm:col-span-2" />
          {viewer.isManager && agents && <AgentField control={form.control} name="agentId" agents={agents} viewer={viewer} label="Done by" />}
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">Related to</p>
          <EntityField control={form.control} name="leadId" label="Lead" kind="lead" initialOption={prefill?.leadOption} />
          <EntityField control={form.control} name="clientId" label="Client" kind="client" initialOption={prefill?.clientOption} />
          <EntityField control={form.control} name="propertyId" label="Property" kind="property" initialOption={prefill?.propertyOption} />
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Log activity
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

export function LogActivitySheet({ open, onOpenChange, ...props }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: LogActivityPrefill; agents?: AgentOption[]; viewer: Viewer }) {
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Log activity" description="Counts towards today's report and score.">
      <LogActivityForm {...props} onSaved={() => onOpenChange(false)} />
    </FormSheet>
  );
}

function OpenFromUrl({ setOpen }: { setOpen: (o: boolean) => void }) {
  useCreateParam(setOpen, "log");
  return null;
}

export function LogActivityButton({ label = "Log activity", variant = "outline", openFromUrl, ...props }: { label?: string; variant?: "outline" | "default" | "secondary" | "ghost"; openFromUrl?: boolean; prefill?: LogActivityPrefill; agents?: AgentOption[]; viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {openFromUrl && <OpenFromUrl setOpen={setOpen} />}
      <Button variant={variant} onClick={() => setOpen(true)}>
        <PhoneCall /> {label}
      </Button>
      <LogActivitySheet open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}
