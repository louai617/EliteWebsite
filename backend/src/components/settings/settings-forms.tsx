"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { changePasswordAction, updateProfileAction } from "@/actions/auth";
import { updateSettingsAction } from "@/actions/admin";
import { useFormAction } from "@/hooks/use-action";
import { calculateCommission } from "@/lib/commission";
import { formatMoney } from "@/lib/format";
import { settingsSchema, type SettingsInput } from "@/schemas/settings";
import { changePasswordSchema, profileSchema } from "@/schemas/user";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { CheckboxField, TextField } from "@/components/shared/form/fields";

export function ProfileForm({ profile }: { profile: { name: string; phone: string | null; avatarUrl: string | null } }) {
  const form = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile.name, phone: profile.phone ?? "", avatarUrl: profile.avatarUrl ?? "" },
  });
  const submit = useFormAction(form, updateProfileAction);
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="name" label="Full name" required />
        <TextField control={form.control} name="phone" label="Phone" type="tel" />
        <TextField control={form.control} name="avatarUrl" label="Avatar URL" type="url" className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <Button type="submit" loading={form.formState.isSubmitting}>
            Save profile
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function PasswordForm() {
  const form = useForm<z.input<typeof changePasswordSchema>, unknown, z.output<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const submit = useFormAction(form, changePasswordAction, { onSuccess: () => form.reset() });
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="currentPassword" label="Current password" type="password" autoComplete="current-password" required className="sm:col-span-2" />
        <TextField control={form.control} name="newPassword" label="New password" type="password" autoComplete="new-password" required description="10+ characters, upper & lower case and a number." />
        <TextField control={form.control} name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required />
        <div className="sm:col-span-2">
          <Button type="submit" loading={form.formState.isSubmitting}>
            Change password
          </Button>
        </div>
      </form>
    </Form>
  );
}

function Example({ control }: { control: ReturnType<typeof useForm<SettingsInput, unknown, z.output<typeof settingsSchema>>>["control"] }) {
  const [sale, rental, share] = useWatch({ control, name: ["saleCommissionPercent", "rentalCommissionPercent", "agentSharePercent"] });
  const n = (v: unknown) => Number(v) || 0;
  const saleEx = calculateCommission({ amount: 2_000_000, commissionPercent: n(sale), agentSharePercent: n(share) });
  const rentEx = calculateCommission({ amount: 144_000, commissionPercent: n(rental), agentSharePercent: n(share) });
  return (
    <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground sm:col-span-2 sm:grid-cols-2">
      <p>
        Sale of {formatMoney(2_000_000)} → <span className="font-medium text-foreground">{formatMoney(saleEx.commissionAmount)}</span> commission (agent {formatMoney(saleEx.agentCommission)}, company {formatMoney(saleEx.companyCommission)})
      </p>
      <p>
        Rental of {formatMoney(144_000)}/yr → <span className="font-medium text-foreground">{formatMoney(rentEx.commissionAmount)}</span> commission (agent {formatMoney(rentEx.agentCommission)}, company {formatMoney(rentEx.companyCommission)})
      </p>
    </div>
  );
}

export function CompanySettingsForm({ settings, editable }: { settings: SettingsInput; editable: boolean }) {
  const form = useForm<SettingsInput, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema), defaultValues: settings });
  const submit = useFormAction(form, updateSettingsAction);
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <fieldset disabled={!editable} className="contents">
          <TextField control={form.control} name="companyName" label="Company name" required />
          <TextField control={form.control} name="defaultCurrency" label="Default currency" required maxLength={3} />
          <TextField control={form.control} name="saleCommissionPercent" label="Sale commission %" inputMode="decimal" required description="Default for new sale deals" />
          <TextField control={form.control} name="rentalCommissionPercent" label="Rental commission %" inputMode="decimal" required description="Of the total contract value (8.33% ≈ one month)" />
          <TextField control={form.control} name="agentSharePercent" label="Agent share %" inputMode="decimal" required description="Share of each commission paid to the agent" />
        </fieldset>
        <Example control={form.control} />
        <fieldset disabled={!editable} className="contents">
          <p className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">Lead response</p>
          <TextField control={form.control} name="leadResponseSlaMinutes" label="Response time target (minutes)" inputMode="numeric" required description="Due time of the automatic “Respond to new lead” task" />
          <CheckboxField control={form.control} name="autoLeadResponseTasks" label="Create a response task when a lead is assigned" className="self-center sm:mt-4" />
        </fieldset>
        {editable ? (
          <div className="sm:col-span-2">
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save company settings
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">Changes apply to new deals. Existing deals keep the rates they were created with.</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground sm:col-span-2">Only admins can change company settings.</p>
        )}
      </form>
    </Form>
  );
}
