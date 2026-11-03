"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { createOwnerAction, updateOwnerAction } from "@/actions/owners";
import { useFormAction } from "@/hooks/use-action";
import { ownerSchema, type OwnerInput } from "@/schemas/owner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet, useCreateParam } from "@/components/shared/form-sheet";
import { TextField, TextareaField } from "@/components/shared/form/fields";
import type { z } from "zod";

type OwnerValues = z.output<typeof ownerSchema>;

export interface OwnerFormRecord {
  id: string;
  fullName: string;
  phone: string;
  secondaryPhone: string | null;
  email: string | null;
  nationality: string | null;
  notes: string | null;
}

function OwnerForm({ owner, onDone }: { owner?: OwnerFormRecord; onDone: (id: string) => void }) {
  const form = useForm<OwnerInput, unknown, OwnerValues>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      fullName: owner?.fullName ?? "",
      phone: owner?.phone ?? "",
      secondaryPhone: owner?.secondaryPhone ?? "",
      email: owner?.email ?? "",
      nationality: owner?.nationality ?? "",
      notes: owner?.notes ?? "",
    },
  });
  const submit = useFormAction(form, (values: OwnerValues) => (owner ? updateOwnerAction({ ...values, id: owner.id }) : createOwnerAction(values)), {
    onSuccess: (data) => onDone((data as { id: string }).id),
  });
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="fullName" label="Full name" required className="sm:col-span-2" autoFocus />
          <TextField control={form.control} name="phone" label="Phone" required type="tel" placeholder="+974 5512 3456" />
          <TextField control={form.control} name="secondaryPhone" label="Secondary phone" type="tel" />
          <TextField control={form.control} name="email" label="E-mail" type="email" />
          <TextField control={form.control} name="nationality" label="Nationality" />
          <TextareaField control={form.control} name="notes" label="Notes" className="sm:col-span-2" rows={4} placeholder="Preferred contact times, negotiation stance, family company details…" />
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {owner ? "Save changes" : "Add owner"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

export function CreateOwnerButton({ openFromUrl = false }: { openFromUrl?: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      {openFromUrl && <CreateFromUrl setOpen={setOpen} />}
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add owner
      </Button>
      <FormSheet open={open} onOpenChange={setOpen} title="New owner" description="Owners can be linked to any number of properties.">
        <OwnerForm
          onDone={(id) => {
            setOpen(false);
            router.push(`/owners/${id}`);
          }}
        />
      </FormSheet>
    </>
  );
}

function CreateFromUrl({ setOpen }: { setOpen: (open: boolean) => void }) {
  useCreateParam(setOpen);
  return null;
}

export function EditOwnerButton({ owner }: { owner: OwnerFormRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      <FormSheet open={open} onOpenChange={setOpen} title={`Edit ${owner.fullName}`}>
        <OwnerForm owner={owner} onDone={() => setOpen(false)} />
      </FormSheet>
    </>
  );
}
