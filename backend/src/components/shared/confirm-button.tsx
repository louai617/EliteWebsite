"use client";

import { useState } from "react";
import type { ActionResult } from "@/types/action";
import { useAction } from "@/hooks/use-action";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Destructive/irreversible action behind a confirmation dialog. Renders its own trigger
 * (children) or can be driven with `open`/`onOpenChange` from a dropdown item.
 */
export function ConfirmAction<I, O>({
  title,
  description,
  confirmLabel = "Delete",
  destructive = true,
  action,
  input,
  onDone,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  action: (input: I) => Promise<ActionResult<O>>;
  input: I;
  onDone?: (data: O) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { run, pending } = useAction(action, {
    onSuccess: (data) => {
      setOpen(false);
      onDone?.(data);
    },
  });

  return (
    <>
      {children && (
        <span onClick={() => setOpen(true)} className="contents">
          {children}
        </span>
      )}
      <AlertDialog open={isOpen} onOpenChange={(v) => !pending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button variant={destructive ? "destructive" : "default"} loading={pending} onClick={() => void run(input)}>
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
