"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import type { z } from "zod";
import { createClientAction, updateClientAction } from "@/actions/clients";
import { useFormAction } from "@/hooks/use-action";
import { CUSTOMER_TYPE_META, options } from "@/lib/constants";
import { clientSchema, type ClientInput } from "@/schemas/client";
import type { ActionResult } from "@/types/action";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet, useCreateParam } from "@/components/shared/form-sheet";
import { AgentField } from "@/components/shared/form/agent-field";
import { SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

type ClientValues = z.output<typeof clientSchema>;

export interface ClientRecord {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  nationality: string | null;
  idReference: string | null;
  clientType: ClientInput["clientType"];
  budgetMin: number | null;
  budgetMax: number | null;
  requirements: string | null;
  notes: string | null;
  agentId: string | null;
}

function ClientForm({ client, agents, viewer, onSaved }: { client?: ClientRecord; agents: AgentOption[]; viewer: Viewer; onSaved: (id: string) => void }) {
  const form = useForm<ClientInput, unknown, ClientValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      fullName: client?.fullName ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      nationality: client?.nationality ?? "",
      idReference: client?.idReference ?? "",
      clientType: client?.clientType ?? "BUYER",
      budgetMin: client?.budgetMin ?? "",
      budgetMax: client?.budgetMax ?? "",
      requirements: client?.requirements ?? "",
      notes: client?.notes ?? "",
      agentId: client ? client.agentId : viewer.isManager ? null : viewer.id,
    },
  });
  const submit = useFormAction(
    form,
    (values: ClientValues): Promise<ActionResult<{ id: string }>> => (client ? updateClientAction({ ...values, id: client.id }) : createClientAction(values)),
    { onSuccess: (data) => onSaved(data.id) },
  );
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="fullName" label="Full name" required className="sm:col-span-2" autoFocus={!client} />
          <TextField control={form.control} name="phone" label="Phone" required type="tel" />
          <TextField control={form.control} name="email" label="E-mail" type="email" />
          <TextField control={form.control} name="nationality" label="Nationality" />
          <TextField control={form.control} name="idReference" label="QID / passport ref." description="Only store what the contract needs." />
          <SelectField control={form.control} name="clientType" label="Client type" required options={options(CUSTOMER_TYPE_META)} />
          <AgentField control={form.control} name="agentId" agents={agents} viewer={viewer} />
          <TextField control={form.control} name="budgetMin" label="Budget min (QAR)" inputMode="numeric" />
          <TextField control={form.control} name="budgetMax" label="Budget max (QAR)" inputMode="numeric" />
          <TextareaField control={form.control} name="requirements" label="Requirements" className="sm:col-span-2" rows={3} />
          <TextareaField control={form.control} name="notes" label="Notes" className="sm:col-span-2" rows={3} />
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {client ? "Save changes" : "Add client"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

export function ClientSheet({ open, onOpenChange, onSaved, ...props }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (id: string) => void; client?: ClientRecord; agents: AgentOption[]; viewer: Viewer }) {
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={props.client ? `Edit ${props.client.fullName}` : "New client"}>
      <ClientForm
        {...props}
        onSaved={(id) => {
          onOpenChange(false);
          onSaved?.(id);
        }}
      />
    </FormSheet>
  );
}

function OpenFromUrl({ setOpen }: { setOpen: (o: boolean) => void }) {
  useCreateParam(setOpen);
  return null;
}

export function CreateClientButton({ agents, viewer, openFromUrl }: { agents: AgentOption[]; viewer: Viewer; openFromUrl?: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      {openFromUrl && <OpenFromUrl setOpen={setOpen} />}
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add client
      </Button>
      <ClientSheet open={open} onOpenChange={setOpen} agents={agents} viewer={viewer} onSaved={(id) => router.push(`/clients/${id}`)} />
    </>
  );
}
