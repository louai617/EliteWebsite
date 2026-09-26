"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createDealAction, updateDealAction } from "@/actions/deals";
import { useFormAction } from "@/hooks/use-action";
import { calculateCommission } from "@/lib/commission";
import { DEAL_STATUS_META, DEAL_TYPE_META, options } from "@/lib/constants";
import { formatMoney, toDateInput } from "@/lib/format";
import { dealSchema, type DealInput } from "@/schemas/deal";
import type { ActionResult } from "@/types/action";
import type { AgentOption, Viewer } from "@/types/options";
import type { LookupOption } from "@/types/search";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet } from "@/components/shared/form-sheet";
import { AgentField } from "@/components/shared/form/agent-field";
import { EntityField, SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

type DealValues = z.output<typeof dealSchema>;

export interface CommissionDefaults {
  saleCommissionPercent: number;
  rentalCommissionPercent: number;
  agentSharePercent: number;
}

export interface DealRecord {
  id: string;
  reference: string;
  propertyId: string;
  clientId: string;
  leadId: string | null;
  agentId: string | null;
  type: DealInput["type"];
  status: DealInput["status"];
  amount: number;
  commissionPercent: number;
  agentSharePercent: number;
  contractDate: Date | null;
  closingDate: Date | null;
  notes: string | null;
  property: { id: string; reference: string; title: string };
  client: { id: string; fullName: string };
  lead: { id: string; fullName: string } | null;
}

export interface DealPrefill {
  propertyId?: string;
  clientId?: string;
  leadId?: string;
  type?: DealInput["type"];
  amount?: number;
  propertyOption?: LookupOption | null;
  clientOption?: LookupOption | null;
  leadOption?: LookupOption | null;
}

function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function CommissionPreview({ control }: { control: ReturnType<typeof useForm<DealInput, unknown, DealValues>>["control"] }) {
  const [amount, commissionPercent, agentSharePercent] = useWatch({ control, name: ["amount", "commissionPercent", "agentSharePercent"] });
  const c = calculateCommission({ amount: num(amount), commissionPercent: num(commissionPercent), agentSharePercent: num(agentSharePercent) });
  return (
    <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/40 p-3 text-center sm:col-span-2" aria-live="polite">
      <div>
        <p className="text-[11px] text-muted-foreground">Commission</p>
        <p className="tabular text-sm font-semibold">{formatMoney(c.commissionAmount)}</p>
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">Agent</p>
        <p className="tabular text-sm font-semibold">{formatMoney(c.agentCommission)}</p>
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">Company</p>
        <p className="tabular text-sm font-semibold">{formatMoney(c.companyCommission)}</p>
      </div>
    </div>
  );
}

function DealForm({ deal, prefill, defaults, agents, viewer, onSaved }: { deal?: DealRecord; prefill?: DealPrefill; defaults: CommissionDefaults; agents: AgentOption[]; viewer: Viewer; onSaved: (id: string) => void }) {
  const type = deal?.type ?? prefill?.type ?? "RENTAL";
  const form = useForm<DealInput, unknown, DealValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      propertyId: deal?.propertyId ?? prefill?.propertyId ?? "",
      clientId: deal?.clientId ?? prefill?.clientId ?? "",
      leadId: deal?.leadId ?? prefill?.leadId ?? null,
      agentId: deal ? deal.agentId : null,
      type,
      status: deal?.status ?? "NEGOTIATION",
      amount: deal?.amount ?? prefill?.amount ?? "",
      commissionPercent: deal?.commissionPercent ?? (type === "SALE" ? defaults.saleCommissionPercent : defaults.rentalCommissionPercent),
      agentSharePercent: deal?.agentSharePercent ?? defaults.agentSharePercent,
      contractDate: toDateInput(deal?.contractDate),
      closingDate: toDateInput(deal?.closingDate),
      notes: deal?.notes ?? "",
    },
  });

  const submit = useFormAction(
    form,
    (values: DealValues): Promise<ActionResult<{ id: string }>> => (deal ? updateDealAction({ ...values, id: deal.id }) : createDealAction(values)),
    { onSuccess: (data) => onSaved(data.id) },
  );

  // When the deal type changes, swap to the matching default rate unless it was customised.
  useEffect(
    () =>
      form.subscribe({
        name: "type",
        formState: { values: true },
        callback: ({ values }) => {
          const current = num(values.commissionPercent);
          if (current === defaults.saleCommissionPercent || current === defaults.rentalCommissionPercent) {
            form.setValue("commissionPercent", values.type === "SALE" ? defaults.saleCommissionPercent : defaults.rentalCommissionPercent);
          }
        },
      }),
    [form, defaults],
  );
  const dealType = useWatch({ control: form.control, name: "type" });

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
            initialOption={deal ? { id: deal.property.id, label: `${deal.property.reference} · ${deal.property.title}` } : prefill?.propertyOption}
          />
          <EntityField control={form.control} name="clientId" label="Client" kind="client" required initialOption={deal ? { id: deal.client.id, label: deal.client.fullName } : prefill?.clientOption} description="Convert the lead to a client first if needed." />
          <EntityField control={form.control} name="leadId" label="Originating lead" kind="lead" initialOption={deal?.lead ? { id: deal.lead.id, label: deal.lead.fullName } : prefill?.leadOption} />
          <SelectField control={form.control} name="type" label="Deal type" required options={options(DEAL_TYPE_META)} />
          <SelectField control={form.control} name="status" label="Status" required options={options(DEAL_STATUS_META)} />
          <TextField
            control={form.control}
            name="amount"
            label={dealType === "RENTAL" ? "Contract value (QAR)" : "Sale price (QAR)"}
            description={dealType === "RENTAL" ? "Total for the contract term, e.g. 12 × monthly rent." : undefined}
            required
            inputMode="numeric"
          />
          <AgentField control={form.control} name="agentId" agents={agents} viewer={viewer} label="Agent" />
          <TextField control={form.control} name="commissionPercent" label="Commission %" inputMode="decimal" required />
          <TextField control={form.control} name="agentSharePercent" label="Agent share %" inputMode="decimal" required description="Of the commission" />
          <CommissionPreview control={form.control} />
          <TextField control={form.control} name="contractDate" label="Contract date" type="date" />
          <TextField control={form.control} name="closingDate" label="Closing date" type="date" />
          <TextareaField control={form.control} name="notes" label="Notes" className="sm:col-span-2" rows={3} />
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {deal ? "Save changes" : "Create deal"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

export function DealSheet({ open, onOpenChange, onSaved, ...props }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (id: string) => void; deal?: DealRecord; prefill?: DealPrefill; defaults: CommissionDefaults; agents: AgentOption[]; viewer: Viewer }) {
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={props.deal ? `Edit ${props.deal.reference}` : "New deal"} description={props.deal ? undefined : "Commission is calculated from the amount and your company defaults."}>
      <DealForm
        {...props}
        onSaved={(id) => {
          onOpenChange(false);
          onSaved?.(id);
        }}
      />
    </FormSheet>
  );
}
