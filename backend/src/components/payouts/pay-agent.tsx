"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Banknote, Ban } from "lucide-react";
import { createPayoutAction, voidPayoutAction } from "@/actions/payouts";
import { useAction, useFormAction } from "@/hooks/use-action";
import { PAYOUT_METHOD_META, options } from "@/lib/constants";
import { formatMoney, toDateInput } from "@/lib/format";
import { payoutSchema, type PayoutInput } from "@/schemas/payout";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet } from "@/components/shared/form-sheet";
import { ReasonDialog } from "@/components/shared/reason-dialog";
import { SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

export interface PayableAgent {
  id: string;
  name: string;
  balance: number;
}

function PayForm({ agents, agentId, onDone }: { agents: PayableAgent[]; agentId?: string; onDone: (id: string) => void }) {
  const first = agents.find((a) => a.id === agentId) ?? agents[0];
  const form = useForm<PayoutInput, unknown, z.output<typeof payoutSchema>>({
    resolver: zodResolver(payoutSchema),
    defaultValues: { agentId: first?.id ?? "", amount: first?.balance ? String(first.balance) : "", method: "CASH", note: "", paidAt: toDateInput(new Date()) },
  });
  const watchedId = useWatch({ control: form.control, name: "agentId" });
  const selected = agents.find((a) => a.id === watchedId);
  const submit = useFormAction(form, createPayoutAction, { onSuccess: (data) => onDone((data as { id: string }).id) });

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="space-y-4">
          <SelectField
            control={form.control}
            name="agentId"
            label="Agent"
            required
            options={agents.map((a) => ({ value: a.id, label: `${a.name} — balance ${formatMoney(a.balance)}` }))}
          />
          {selected && (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              Balance to pay: <strong className="tabular">{formatMoney(selected.balance)}</strong>
              <button type="button" className="ml-2 text-xs text-muted-foreground underline" onClick={() => form.setValue("amount", String(selected.balance), { shouldValidate: true })}>
                Pay all
              </button>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="amount" label="Amount (QAR)" required inputMode="numeric" description="Taken off the agent's commission balance." />
            <SelectField control={form.control} name="method" label="Paid by" required options={options(PAYOUT_METHOD_META)} />
            <TextField control={form.control} name="paidAt" label="Date paid" type="date" />
          </div>
          <TextareaField control={form.control} name="note" label="Note on the voucher" rows={3} placeholder="e.g. Partial payment for October — deals DL-1004 and DL-1007" />
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            <Banknote /> Pay and issue voucher
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

/** Admins: pay an agent from their commission balance; opens the new voucher. */
export function PayAgentButton({ agents, agentId, label = "Pay agent", variant, size }: { agents: PayableAgent[]; agentId?: string; label?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const payable = agents.filter((a) => a.balance > 0);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={!payable.length} title={payable.length ? undefined : "No balance left to pay"}>
        <Banknote /> {label}
      </Button>
      <FormSheet open={open} onOpenChange={setOpen} title="Pay commission" description="The amount comes off the agent's balance and a voucher is created for your records and theirs.">
        <PayForm
          agents={payable}
          agentId={agentId}
          onDone={(id) => {
            setOpen(false);
            router.push(`/vouchers/${id}`);
          }}
        />
      </FormSheet>
    </>
  );
}

/** Admins: cancel a voucher; the amount goes back on the balance. */
export function VoidVoucherButton({ id, reference }: { id: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const run = useAction(voidPayoutAction);
  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)} aria-label={`Cancel voucher ${reference}`}>
        <Ban /> Cancel
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={`Cancel voucher ${reference}?`}
        description="It stays in the history marked as cancelled, and the amount goes back on the agent's balance."
        label="Why"
        confirmLabel="Cancel voucher"
        destructive
        onSubmit={async (reason) => {
          const r = await run.run({ id, reason });
          if (r?.ok) router.refresh();
          return Boolean(r?.ok);
        }}
      />
    </>
  );
}
