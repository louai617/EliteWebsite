"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createViewingAction, updateViewingAction } from "@/actions/viewings";
import { useFormAction } from "@/hooks/use-action";
import { VIEWING_STATUS_META, options } from "@/lib/constants";
import { toDateTimeInput, zonedDayStart } from "@/lib/format";
import { viewingSchema, type ViewingInput } from "@/schemas/viewing";
import type { ActionResult } from "@/types/action";
import type { AgentOption, Viewer } from "@/types/options";
import type { LookupOption } from "@/types/search";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet } from "@/components/shared/form-sheet";
import { AgentField } from "@/components/shared/form/agent-field";
import { EntityField, SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

type ViewingValues = z.output<typeof viewingSchema>;

export interface ViewingRecord {
  id: string;
  propertyId: string;
  leadId: string | null;
  clientId: string | null;
  agentId: string | null;
  startsAt: Date;
  endsAt: Date;
  status: ViewingInput["status"];
  notes: string | null;
  property?: { id: string; reference: string; title: string } | null;
  lead?: { id: string; fullName: string } | null;
  client?: { id: string; fullName: string } | null;
}

export interface ViewingPrefill {
  propertyId?: string;
  leadId?: string;
  clientId?: string;
  agentId?: string | null;
  propertyOption?: LookupOption | null;
  leadOption?: LookupOption | null;
  clientOption?: LookupOption | null;
}

/** Tomorrow 11:00 Doha time. */
function nextSlot() {
  return new Date(zonedDayStart(1).getTime() + 11 * 3_600_000);
}

function ViewingForm({ viewing, prefill, agents, viewer, onSaved }: { viewing?: ViewingRecord; prefill?: ViewingPrefill; agents: AgentOption[]; viewer: Viewer; onSaved: () => void }) {
  const start = viewing?.startsAt ?? nextSlot();
  const form = useForm<ViewingInput, unknown, ViewingValues>({
    resolver: zodResolver(viewingSchema),
    defaultValues: {
      propertyId: viewing?.propertyId ?? prefill?.propertyId ?? "",
      leadId: viewing?.leadId ?? prefill?.leadId ?? null,
      clientId: viewing?.clientId ?? prefill?.clientId ?? null,
      agentId: viewing ? viewing.agentId : (prefill?.agentId ?? viewer.id),
      startsAt: toDateTimeInput(start),
      endsAt: toDateTimeInput(viewing?.endsAt ?? new Date(new Date(start).getTime() + 45 * 60_000)),
      status: viewing?.status ?? "SCHEDULED",
      notes: viewing?.notes ?? "",
    },
  });

  const submit = useFormAction(
    form,
    (values: ViewingValues): Promise<ActionResult<{ id: string }>> => (viewing ? updateViewingAction({ ...values, id: viewing.id }) : createViewingAction(values)),
    { onSuccess: onSaved },
  );

  // Keep the end time 45 minutes after the start when the start moves forward past it.
  const onStartBlur = () => {
    const s = new Date(String(form.getValues("startsAt")));
    const e = new Date(String(form.getValues("endsAt")));
    if (!Number.isNaN(s.getTime()) && (Number.isNaN(e.getTime()) || e <= s)) {
      form.setValue("endsAt", toDateTimeInput(new Date(s.getTime() + 45 * 60_000)));
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
          <EntityField
            control={form.control}
            name="propertyId"
            label="Property"
            kind="property"
            required
            className="sm:col-span-2"
            initialOption={viewing?.property ? { id: viewing.property.id, label: `${viewing.property.reference} · ${viewing.property.title}` } : prefill?.propertyOption}
          />
          <EntityField
            control={form.control}
            name="leadId"
            label="Lead"
            kind="lead"
            placeholder="Search leads…"
            initialOption={viewing?.lead ? { id: viewing.lead.id, label: viewing.lead.fullName } : prefill?.leadOption}
            description="Choose a lead, a client, or both."
          />
          <EntityField
            control={form.control}
            name="clientId"
            label="Client"
            kind="client"
            placeholder="Search clients…"
            initialOption={viewing?.client ? { id: viewing.client.id, label: viewing.client.fullName } : prefill?.clientOption}
          />
          <TextField control={form.control} name="startsAt" label="Starts" type="datetime-local" required onBlurCapture={onStartBlur} />
          <TextField control={form.control} name="endsAt" label="Ends" type="datetime-local" required />
          <AgentField control={form.control} name="agentId" agents={agents} viewer={viewer} label="Agent" />
          <SelectField control={form.control} name="status" label="Status" required options={options(VIEWING_STATUS_META)} />
          <TextareaField control={form.control} name="notes" label="Notes" className="sm:col-span-2" rows={3} placeholder="Access instructions, gate code, client preferences…" />
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {viewing ? "Save changes" : "Schedule viewing"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

export function ViewingSheet({ open, onOpenChange, onSaved, ...props }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: () => void; viewing?: ViewingRecord; prefill?: ViewingPrefill; agents: AgentOption[]; viewer: Viewer }) {
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={props.viewing ? "Edit viewing" : "Schedule viewing"} description={props.viewing ? undefined : "Overlapping viewings for the same agent are blocked."}>
      <ViewingForm
        {...props}
        onSaved={() => {
          onOpenChange(false);
          onSaved?.();
        }}
      />
    </FormSheet>
  );
}
