"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createLeadAction, updateLeadAction } from "@/actions/leads";
import { useFormAction } from "@/hooks/use-action";
import type { ActionResult } from "@/types/action";
import { CUSTOMER_TYPE_META, FURNISHING_META, LEAD_SOURCE_META, LEAD_STATUS_META, PRIORITY_META, PURPOSE_META, QATAR_AREAS, options } from "@/lib/constants";
import { leadSchema, type LeadInput } from "@/schemas/lead";
import type { AgentOption, Viewer } from "@/types/options";
import type { LookupOption } from "@/types/search";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet } from "@/components/shared/form-sheet";
import { AgentField } from "@/components/shared/form/agent-field";
import { EntityField, SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

type LeadValues = z.output<typeof leadSchema>;

export interface LeadRecord {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  nationality: string | null;
  source: LeadInput["source"];
  leadType: string | null;
  interestedArea: string | null;
  purpose: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  bedrooms: number | null;
  furnishing: string | null;
  notes: string | null;
  agentId: string | null;
  status: LeadInput["status"];
  priority: LeadInput["priority"];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

function LeadForm({
  lead,
  defaults,
  propertyOption,
  agents,
  viewer,
  onSaved,
}: {
  lead?: LeadRecord;
  defaults?: Partial<LeadInput>;
  propertyOption?: LookupOption | null;
  agents: AgentOption[];
  viewer: Viewer;
  onSaved: (id: string) => void;
}) {
  const form = useForm<LeadInput, unknown, LeadValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      fullName: lead?.fullName ?? "",
      phone: lead?.phone ?? "",
      email: lead?.email ?? "",
      nationality: lead?.nationality ?? "",
      source: lead?.source ?? "PROPERTY_FINDER",
      leadType: lead?.leadType ?? null,
      interestedPropertyId: null,
      interestedArea: lead?.interestedArea ?? "",
      purpose: lead?.purpose ?? null,
      budgetMin: lead?.budgetMin ?? "",
      budgetMax: lead?.budgetMax ?? "",
      bedrooms: lead?.bedrooms ?? "",
      furnishing: lead?.furnishing ?? null,
      notes: lead?.notes ?? "",
      agentId: lead ? lead.agentId : viewer.isManager ? null : viewer.id,
      status: lead?.status ?? "NEW",
      priority: lead?.priority ?? "MEDIUM",
      ...defaults,
    },
  });
  const submit = useFormAction(form, (values: LeadValues): Promise<ActionResult<{ id: string }>> => (lead ? updateLeadAction({ ...values, id: lead.id }) : createLeadAction(values)), {
    onSuccess: (data) => onSaved((data as { id: string }).id),
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="space-y-6">
          <Section title="Contact">
            <TextField control={form.control} name="fullName" label="Full name" required className="sm:col-span-2" autoFocus={!lead} />
            <TextField control={form.control} name="phone" label="Phone" required type="tel" placeholder="+974 5512 3456" />
            <TextField control={form.control} name="email" label="E-mail" type="email" />
            <TextField control={form.control} name="nationality" label="Nationality" />
            <SelectField control={form.control} name="source" label="Source" required options={options(LEAD_SOURCE_META)} />
          </Section>
          <Section title="Requirements">
            <SelectField control={form.control} name="purpose" label="Purpose" options={options(PURPOSE_META)} allowEmpty emptyLabel="Not sure yet" />
            <SelectField control={form.control} name="leadType" label="Lead type" options={options(CUSTOMER_TYPE_META)} allowEmpty emptyLabel="Not specified" />
            <EntityField control={form.control} name="interestedPropertyId" label={lead ? "Add interested property" : "Interested property"} kind="property" placeholder="Search listings…" initialOption={propertyOption} className="sm:col-span-2" />
            <SelectField control={form.control} name="interestedArea" label="Preferred area" options={QATAR_AREAS.map((a) => ({ value: a, label: a }))} allowEmpty emptyLabel="Any area" />
            <TextField control={form.control} name="bedrooms" label="Bedrooms" inputMode="numeric" />
            <TextField control={form.control} name="budgetMin" label="Budget min (QAR)" inputMode="numeric" />
            <TextField control={form.control} name="budgetMax" label="Budget max (QAR)" inputMode="numeric" />
            <SelectField control={form.control} name="furnishing" label="Furnishing" options={options(FURNISHING_META)} allowEmpty emptyLabel="No preference" />
          </Section>
          <Section title="Pipeline">
            <SelectField control={form.control} name="status" label="Status" required options={options(LEAD_STATUS_META)} />
            <SelectField control={form.control} name="priority" label="Priority" required options={options(PRIORITY_META)} />
            <AgentField control={form.control} name="agentId" agents={agents} viewer={viewer} className="sm:col-span-2" />
            <TextareaField control={form.control} name="notes" label="Notes" rows={3} className="sm:col-span-2" />
          </Section>
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {lead ? "Save changes" : "Create lead"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

export function LeadSheet({
  open,
  onOpenChange,
  onSaved,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
  lead?: LeadRecord;
  defaults?: Partial<LeadInput>;
  propertyOption?: LookupOption | null;
  agents: AgentOption[];
  viewer: Viewer;
}) {
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={props.lead ? `Edit ${props.lead.fullName}` : "New lead"} description={props.lead ? undefined : "Capture an enquiry from any channel."}>
      <LeadForm
        {...props}
        onSaved={(id) => {
          onOpenChange(false);
          onSaved?.(id);
        }}
      />
    </FormSheet>
  );
}
