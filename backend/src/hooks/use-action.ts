"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionResult } from "@/types/action";

/**
 * Runs a Server Action from an event handler with a pending flag and toast feedback.
 * Concurrent calls are ignored while one is in flight (no double submissions).
 */
export function useAction<I, O>(action: (input: I) => Promise<ActionResult<O>>, options: { onSuccess?: (data: O) => void; successMessage?: string; silent?: boolean } = {}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const { onSuccess, successMessage, silent } = options;

  const run = useCallback(
    (input: I) =>
      new Promise<ActionResult<O> | undefined>((resolve) => {
        if (busy) return resolve(undefined);
        setBusy(true);
        startTransition(async () => {
          try {
            const result = await action(input);
            if (result.ok) {
              if (!silent) toast.success(result.message ?? successMessage ?? "Saved");
              onSuccess?.(result.data);
            } else {
              toast.error(result.error);
            }
            resolve(result);
          } catch {
            toast.error("Network error — please check your connection and try again.");
            resolve(undefined);
          } finally {
            setBusy(false);
          }
        });
      }),
    [action, busy, onSuccess, successMessage, silent],
  );

  return { run, pending: pending || busy };
}

/**
 * Submits react-hook-form values to a Server Action. Server-side field errors are mapped
 * back onto the form so validation messages appear inline even when only the server knows.
 */
export function useFormAction<TValues extends FieldValues, TOut, O>(
  form: UseFormReturn<TValues, unknown, TOut>,
  action: (input: TOut) => Promise<ActionResult<O>>,
  options: { onSuccess?: (data: O) => void; successMessage?: string } = {},
) {
  return form.handleSubmit(async (values) => {
    try {
      const result = await action(values);
      if (result.ok) {
        toast.success(result.message ?? options.successMessage ?? "Saved");
        options.onSuccess?.(result.data);
        return;
      }
      toast.error(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field === "_form") continue;
        form.setError(field as Path<TValues>, { type: "server", message: messages[0] });
      }
    } catch {
      toast.error("Network error — please check your connection and try again.");
    }
  });
}
