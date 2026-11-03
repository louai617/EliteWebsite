"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus } from "lucide-react";
import { addPoolLeadAction, updatePoolLeadAction } from "@/actions/leads-pool";
import { useFormAction } from "@/hooks/use-action";
import type { ActionResult } from "@/types/action";
import { CUSTOMER_TYPE_META, PURPOSE_META, QATAR_AREAS, options } from "@/lib/constants";
import { poolLeadSchema, type PoolLeadInput } from "@/schemas/leads-pool";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet } from "@/components/shared/form-sheet";
import { SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

type PoolValues = z.output<typeof poolLeadSchema>;

export interface PoolLeadRecord {
  id: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  leadType: string | null;
  purpose: string | null;
  interestedArea: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  bedrooms: number | null;
  notes: string | null;
}

function PoolLeadForm({ record, onSaved }: { record?: PoolLeadRecord; onSaved: () => void }) {
  const form = useForm<PoolLeadInput, unknown, PoolValues>({
    resolver: zodResolver(poolLeadSchema),
    defaultValues: {
      phone: record?.phone ?? "",
      fullName: record?.fullName ?? "",
      email: record?.email ?? "",
      leadType: record?.leadType ?? null,
      purpose: record?.purpose ?? null,
      interestedArea: record?.interestedArea ?? "",
      budgetMin: record?.budgetMin ?? "",
      budgetMax: record?.budgetMax ?? "",
      bedrooms: record?.bedrooms ?? "",
      notes: record?.notes ?? "",
    },
  });
  const submit = useFormAction(form, (values: PoolValues): Promise<ActionResult<unknown>> => (record ? updatePoolLeadAction({ ...values, id: record.id }) : addPoolLeadAction(values)), {
    onSuccess: onSaved,
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="space-y-6">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contact</legend>
            <TextField control={form.control} name="phone" label="Phone" required type="tel" placeholder="+974 5512 3456" autoFocus={!record} />
            <TextField control={form.control} name="fullName" label="Name" placeholder="Optional" />
            <TextField control={form.control} name="email" label="E-mail" type="email" placeholder="Optional" className="sm:col-span-2" />
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Needs (optional)</legend>
            <SelectField control={form.control} name="leadType" label="Who is it" options={options(CUSTOMER_TYPE_META)} allowEmpty emptyLabel="Not specified" />
            <SelectField control={form.control} name="purpose" label="Rent or sale" options={options(PURPOSE_META)} allowEmpty emptyLabel="Not specified" />
            <SelectField control={form.control} name="interestedArea" label="Area" options={QATAR_AREAS.map((a) => ({ value: a, label: a }))} allowEmpty emptyLabel="Any area" />
            <TextField control={form.control} name="bedrooms" label="Bedrooms" inputMode="numeric" />
            <TextField control={form.control} name="budgetMin" label="Budget min (QAR)" inputMode="numeric" />
            <TextField control={form.control} name="budgetMax" label="Budget max (QAR)" inputMode="numeric" />
            <TextareaField control={form.control} name="notes" label="Notes" rows={3} className="sm:col-span-2" placeholder="e.g. Private owner, 2 villas in Al Waab for rent — call after 4 pm" />
          </fieldset>
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {record ? "Save changes" : "Add to pool"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

export function PoolLeadSheet({ open, onOpenChange, record }: { open: boolean; onOpenChange: (open: boolean) => void; record?: PoolLeadRecord }) {
  const router = useRouter();
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Edit pool lead" : "Add to the leads pool"}
      description={record ? undefined : "Only the number is required. Agents see it masked until you approve their request."}
    >
      <PoolLeadForm
        record={record}
        onSaved={() => {
          onOpenChange(false);
          router.refresh();
        }}
      />
    </FormSheet>
  );
}

export function AddPoolLeadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add number
      </Button>
      <PoolLeadSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
