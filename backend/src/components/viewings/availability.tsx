"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CalendarClock, Trash2 } from "lucide-react";
import { addAvailabilityAction, removeAvailabilityAction } from "@/actions/availability";
import { useAction, useFormAction } from "@/hooks/use-action";
import { formatTime, formatZoned, toDateInput } from "@/lib/format";
import { availabilitySchema, type AvailabilityInput } from "@/schemas/availability";
import type { AgentOption, Viewer } from "@/types/options";
import type { AvailabilityBlock } from "@/services/availability";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet } from "@/components/shared/form-sheet";
import { SelectField, TextField } from "@/components/shared/form/fields";

const REPEAT_OPTIONS = [
  { value: "0", label: "Just this day" },
  { value: "1", label: "Also next week" },
  { value: "3", label: "Every week for a month" },
  { value: "7", label: "Every week for 2 months" },
  { value: "12", label: "Every week for 3 months" },
];

function AvailabilityForm({ agents, viewer, date, onDone }: { agents: AgentOption[]; viewer: Viewer; date?: string; onDone: () => void }) {
  const form = useForm<AvailabilityInput, unknown, z.output<typeof availabilitySchema>>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: { agentId: viewer.id, date: date ?? toDateInput(new Date()), from: "16:00", to: "19:00", repeatWeeks: "0" },
  });
  const submit = useFormAction(form, addAvailabilityAction, { onSuccess: onDone });
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="space-y-4">
          {viewer.isManager && (
            <SelectField
              control={form.control}
              name="agentId"
              label="Agent"
              required
              options={agents.map((a) => ({ value: a.id, label: a.id === viewer.id ? `${a.name} (me)` : a.name }))}
            />
          )}
          <TextField control={form.control} name="date" label="Day" type="date" required />
          <div className="grid grid-cols-2 gap-4">
            <TextField control={form.control} name="from" label="From" type="time" step={1800} required />
            <TextField control={form.control} name="to" label="To" type="time" step={1800} required />
          </div>
          <SelectField control={form.control} name="repeatWeeks" label="Repeat" options={REPEAT_OPTIONS} />
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Visitors on the website can book a 45-minute viewing of this agent&apos;s listings inside these hours, every 30 minutes, unless a viewing is already booked
            then. Times outside free hours can&apos;t be booked online.
          </p>
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            <CalendarClock /> Mark as free
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

/** "Free for viewings" button above the calendar. */
export function AvailabilityButton({ agents, viewer }: { agents: AgentOption[]; viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarClock /> Free for viewings
      </Button>
      <FormSheet open={open} onOpenChange={setOpen} title="Free for viewings" description="Mark the hours you can show homes. Website visitors only see free times inside them.">
        <AvailabilityForm
          agents={agents}
          viewer={viewer}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </FormSheet>
    </>
  );
}

/** A green "free" block on a calendar day; opens a small card with Remove. */
export function AvailabilityChip({ block, viewer, showAgent }: { block: AvailabilityBlock; viewer: Viewer; showAgent: boolean }) {
  const router = useRouter();
  const remove = useAction(removeAvailabilityAction, { onSuccess: () => router.refresh() });
  const canEdit = viewer.isManager || block.agentId === viewer.id;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex w-full items-center gap-1 truncate rounded bg-emerald-50 px-1 py-0.5 text-left text-[11px] text-emerald-800 hover:bg-emerald-100">
          <span className="tabular shrink-0">
            {formatTime(block.startsAt)}–{formatTime(block.endsAt)}
          </span>
          <span className="truncate">{showAgent ? block.agent.name.split(" ")[0] : "Free"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 text-sm" align="start">
        <p className="font-medium">Free for viewings</p>
        <p className="text-xs text-muted-foreground">
          {formatZoned(block.startsAt, "EEEE d MMMM")} · {formatTime(block.startsAt)}–{formatTime(block.endsAt)}
          <br />
          {block.agent.name}
        </p>
        {canEdit && (
          <div className="flex justify-end">
            <Button size="xs" variant="outline" loading={remove.pending} onClick={() => void remove.run({ id: block.id })}>
              <Trash2 /> Remove
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
