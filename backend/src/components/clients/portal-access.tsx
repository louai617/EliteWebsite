"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { KeyRound } from "lucide-react";
import { grantPortalAccessAction, revokePortalAccessAction } from "@/actions/portal";
import { useFormAction } from "@/hooks/use-action";
import { portalAccessSchema } from "@/schemas/portal";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/shared/form/fields";
import { ConfirmAction } from "@/components/shared/confirm-button";

type Values = z.output<typeof portalAccessSchema>;

export interface PortalAccount {
  email: string;
  isActive: boolean;
  lastLoginAt: Date | null;
}

/** Managers give a CRM client a login for the client portal (or turn it off). */
export function PortalAccessCard({ clientId, defaultEmail, account, portalUrl, canManage }: { clientId: string; defaultEmail: string | null; account: PortalAccount | null; portalUrl: string; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const form = useForm<z.input<typeof portalAccessSchema>, unknown, Values>({
    resolver: zodResolver(portalAccessSchema),
    defaultValues: { clientId, email: account?.email ?? defaultEmail ?? "", password: "" },
  });
  const submit = useFormAction(form, (values: Values) => grantPortalAccessAction(values), { onSuccess: () => setEditing(false) });
  const active = Boolean(account?.isActive);

  return (
    <div className="space-y-3 text-sm">
      {account ? (
        <div>
          <p className="flex items-center gap-2">
            <span className={active ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-muted-foreground/40"} />
            {active ? "Active" : "Disabled"} · <span className="font-medium">{account.email}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{account.lastLoginAt ? `Last sign-in ${formatDateTime(account.lastLoginAt)}` : "Never signed in"}</p>
        </div>
      ) : (
        <p className="text-muted-foreground">This client has no portal login yet.</p>
      )}
      <p className="text-xs text-muted-foreground">
        The portal ({portalUrl}) shows the client only their own shortlist, viewings, enquiries, deals and tasks you mark as visible to them.
      </p>
      {canManage && !editing && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <KeyRound /> {account ? (active ? "Reset password" : "Re-enable access") : "Give portal access"}
          </Button>
          {active && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
              Revoke access
            </Button>
          )}
        </div>
      )}
      {canManage && editing && (
        <Form {...form}>
          <form onSubmit={submit} noValidate className="space-y-3">
            <TextField control={form.control} name="email" label="Login e-mail" type="email" required />
            <TextField control={form.control} name="password" label="Temporary password" type="password" autoComplete="new-password" required description="10+ characters, upper & lower case and a number. Share it securely; the client can change it." />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={form.formState.isSubmitting}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      )}
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title="Revoke portal access?"
        description="The client is signed out everywhere and can no longer log in. Their CRM record is not changed."
        confirmLabel="Revoke"
        action={revokePortalAccessAction}
        input={{ clientId }}
      />
    </div>
  );
}
