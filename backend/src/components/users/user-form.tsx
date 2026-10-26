"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import type { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { createUserAction, updateUserAction } from "@/actions/admin";
import { useFormAction } from "@/hooks/use-action";
import { ROLE_META } from "@/lib/constants";
import { userFormSchema, type UserFormInput } from "@/schemas/user";
import type { ActionResult } from "@/types/action";
import type { Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FormSheet } from "@/components/shared/form-sheet";
import { CheckboxField, SelectField, TextField } from "@/components/shared/form/fields";

type Values = z.output<typeof userFormSchema>;

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
}

function roleOptions(viewer: Viewer) {
  const roles: Role[] = viewer.role === "ADMIN" ? ["ADMIN", "MANAGER", "AGENT"] : ["AGENT"];
  return roles.map((r) => ({ value: r, label: ROLE_META[r].label }));
}

function UserForm({ user, viewer, onSaved }: { user?: UserRecord; viewer: Viewer; onSaved: () => void }) {
  const form = useForm<UserFormInput, unknown, Values>({
    // Create requires a password; edit treats a blank one as "keep current".
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      id: user?.id,
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      role: user?.role ?? "AGENT",
      avatarUrl: user?.avatarUrl ?? "",
      isActive: user?.isActive ?? true,
      password: "",
    },
  });
  const submit = useFormAction(
    form,
    (values: Values): Promise<ActionResult<{ id: string }>> => {
      if (user) return updateUserAction({ ...values, id: user.id });
      const { id: _id, ...rest } = values;
      return createUserAction({ ...rest, password: values.password ?? "" });
    },
    { onSuccess: onSaved },
  );
  const self = user?.id === viewer.id;
  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="name" label="Full name" required className="sm:col-span-2" autoFocus={!user} />
          <TextField control={form.control} name="email" label="E-mail" required type="email" autoComplete="off" />
          <TextField control={form.control} name="phone" label="Phone" type="tel" />
          <SelectField control={form.control} name="role" label="Role" required options={roleOptions(viewer)} />
          <TextField control={form.control} name="avatarUrl" label="Avatar URL" type="url" />
          <TextField
            control={form.control}
            name="password"
            label={user ? "Reset password" : "Initial password"}
            required={!user}
            type="password"
            autoComplete="new-password"
            className="sm:col-span-2"
            description={user ? "Leave blank to keep the current password. Resetting signs the user out everywhere." : "At least 10 characters with upper- and lowercase letters and a number."}
          />
          {!self && <CheckboxField control={form.control} name="isActive" label="Active — can sign in" className="sm:col-span-2" />}
        </SheetBody>
        <SheetFooter>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {user ? "Save changes" : "Add team member"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

export function UserSheetButton({ user, viewer }: { user?: UserRecord; viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {user ? (
        <Button variant="ghost" size="icon-xs" onClick={() => setOpen(true)} aria-label={`Edit ${user.name}`}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> Add team member
        </Button>
      )}
      <FormSheet open={open} onOpenChange={setOpen} title={user ? `Edit ${user.name}` : "New team member"}>
        <UserForm user={user} viewer={viewer} onSaved={() => setOpen(false)} />
      </FormSheet>
    </>
  );
}
