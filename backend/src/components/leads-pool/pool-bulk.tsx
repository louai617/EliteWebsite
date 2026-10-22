"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { addPoolLeadsBulkAction } from "@/actions/leads-pool";
import { useAction } from "@/hooks/use-action";
import { CUSTOMER_TYPE_META, PURPOSE_META, options } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NONE = "__none__";

function OptionalSelect({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not specified</SelectItem>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Paste many numbers at once — one per line, optionally followed by a name. */
export function PoolBulkButton() {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState("");
  const [leadType, setLeadType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [skipped, setSkipped] = useState<{ line: number; text: string; reason: string }[] | null>(null);
  const add = useAction(addPoolLeadsBulkAction);
  const count = lines.split(/\r?\n/).filter((l) => l.trim()).length;

  const close = (o: boolean) => {
    if (add.pending) return;
    setOpen(o);
    if (!o) setSkipped(null);
  };

  const submit = async () => {
    const r = await add.run({ lines, leadType: leadType || null, purpose: purpose || null, notes: notes || null });
    if (!r?.ok) return;
    router.refresh();
    setLines("");
    if (r.data.skipped.length) setSkipped(r.data.skipped);
    else close(false);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ClipboardList /> Paste numbers
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste numbers into the pool</DialogTitle>
            <DialogDescription>One number per line. A name after the number is kept too, e.g. “+974 5512 3456, Ahmed”. Numbers already in the pool are skipped.</DialogDescription>
          </DialogHeader>
          {skipped ? (
            <div className="space-y-2 text-sm">
              <p>
                {skipped.length} line{skipped.length === 1 ? " was" : "s were"} not added:
              </p>
              <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                {skipped.map((s) => (
                  <li key={`${s.line}-${s.text}`}>
                    <span className="text-muted-foreground">Line {s.line}:</span> <span className="font-mono">{s.text}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={id}>
                  Numbers <span className="text-destructive">*</span>
                </Label>
                <Textarea id={id} value={lines} onChange={(e) => setLines(e.target.value)} rows={8} placeholder={"+974 5512 3456, Ahmed\n+974 6612 7788\n+974 3345 9910  Private owner"} className="font-mono text-xs" />
                <p className="text-xs text-muted-foreground">{count ? `${count} line${count === 1 ? "" : "s"}` : "Paste from a spreadsheet, WhatsApp or a text file."}</p>
              </div>
              <p className="text-xs font-medium text-muted-foreground">Applied to every number (optional)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <OptionalSelect label="Who are they" value={leadType} onChange={setLeadType} items={options(CUSTOMER_TYPE_META)} />
                <OptionalSelect label="Rent or sale" value={purpose} onChange={setPurpose} items={options(PURPOSE_META)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-notes`}>Notes</Label>
                <Input id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="e.g. Owners in Lusail from the October campaign" />
              </div>
            </div>
          )}
          <DialogFooter>
            {skipped ? (
              <Button onClick={() => close(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => close(false)} disabled={add.pending}>
                  Cancel
                </Button>
                <Button loading={add.pending} disabled={!count} onClick={() => void submit()}>
                  Add {count || ""} to pool
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
