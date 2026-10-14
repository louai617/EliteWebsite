"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { submitDailyReportAction } from "@/actions/daily";
import { useFormAction } from "@/hooks/use-action";
import { dailyReportSubmitSchema, type DailyReportSubmitInput } from "@/schemas/daily";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextareaField } from "@/components/shared/form/fields";

type Values = z.output<typeof dailyReportSubmitSchema>;

/** End-of-day report: what the agent did, and what blocked them. Counters are filled in automatically. */
export function DailyReportForm({ summary, blockers, submitted }: { summary: string | null; blockers: string | null; submitted: boolean }) {
  const form = useForm<DailyReportSubmitInput, unknown, Values>({
    resolver: zodResolver(dailyReportSubmitSchema),
    defaultValues: { summary: summary ?? "", blockers: blockers ?? "" },
  });
  const submit = useFormAction(form, (values: Values) => submitDailyReportAction(values));
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="space-y-3">
        <TextareaField control={form.control} name="summary" label="Summary of the day" required rows={4} placeholder="Calls made, viewings done, deals progressed…" />
        <TextareaField control={form.control} name="blockers" label="Blockers / help needed" rows={2} />
        <Button type="submit" loading={form.formState.isSubmitting}>
          {submitted ? "Update report" : "Submit report"}
        </Button>
      </form>
    </Form>
  );
}
