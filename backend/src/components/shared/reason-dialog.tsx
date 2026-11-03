"use client";

import { useId, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Asks for a written reason before an action (lost lead, cancelled deal, viewing pass…).
 * `onSubmit` returns true when the action succeeded, which closes the dialog.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  placeholder,
  minLength = 5,
  confirmLabel = "Confirm",
  destructive = false,
  suggestions = [],
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  minLength?: number;
  confirmLabel?: string;
  destructive?: boolean;
  suggestions?: readonly string[];
  onSubmit: (reason: string) => Promise<boolean>;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [touched, setTouched] = useState(false);
  const tooShort = reason.trim().length < minLength;

  const submit = async () => {
    setTouched(true);
    if (tooShort || pending) return;
    setPending(true);
    const ok = await onSubmit(reason.trim()).finally(() => setPending(false));
    if (ok) {
      setReason("");
      setTouched(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReason((r) => (r.trim() ? `${s} — ${r.replace(/^[^—]*—\s*/, "")}` : s))}
                className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent", reason.startsWith(s) && "border-foreground/40 bg-accent font-medium")}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={id}>
            {label} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id={id}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            rows={4}
            maxLength={1000}
            aria-invalid={touched && tooShort}
          />
          {touched && tooShort && <p className="text-xs text-destructive">Write at least {minLength} characters.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Back
          </Button>
          <Button variant={destructive ? "destructive" : "default"} loading={pending} onClick={() => void submit()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
