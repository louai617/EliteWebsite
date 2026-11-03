"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { importPoolFileAction } from "@/actions/leads-pool";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TEMPLATE = [
  ["Phone", "Name", "Type", "Rent or sale", "Area", "Bedrooms", "Budget", "Notes"],
  ["+974 5512 3456", "Ahmed Al-Kuwari", "Buyer", "Sale", "Lusail", "3", "2,000,000 - 3,000,000", "Wants sea view"],
  ["+974 6612 7788", "", "Landlord", "Rent", "Al Waab", "", "", "Private owner, 2 villas"],
  ["+974 3345 9910", "", "", "", "", "", "", ""],
];

function downloadTemplate() {
  const csv = TEMPLATE.map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads-pool-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type Result = { added: number; skipped: { line: number; text: string; reason: string }[]; skippedCount: number; batch: string; columns: { heading: string; field: string | null }[] };

const FIELD_LABELS: Record<string, string> = {
  phone: "Phone",
  fullName: "Name",
  email: "E-mail",
  leadType: "Type",
  purpose: "Rent / sale",
  interestedArea: "Area",
  bedrooms: "Bedrooms",
  budget: "Budget",
  budgetMin: "Budget min",
  budgetMax: "Budget max",
  notes: "Notes",
};

/** Managers: import an Excel (.xlsx) or CSV file into the pool, then pick numbers to give out. */
export function PoolImportButton() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const upload = useAction(importPoolFileAction);

  const close = (o: boolean) => {
    if (upload.pending) return;
    setOpen(o);
    if (!o) {
      setFile(null);
      setResult(null);
    }
  };

  const submit = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    const r = await upload.run(fd);
    if (r?.ok) {
      setResult(r.data as Result);
      router.refresh();
    }
  };

  const showBatch = () => {
    if (!result) return;
    close(false);
    router.push(`/leads-pool?batch=${encodeURIComponent(result.batch)}&size=100`);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet /> Import Excel
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import numbers from Excel</DialogTitle>
            <DialogDescription>
              An Excel (.xlsx) or CSV file with a <strong>Phone</strong> column. Name, type, rent or sale, area, bedrooms, budget and notes are picked up when their columns are there; other columns go into the notes.
            </DialogDescription>
          </DialogHeader>
          {result ? (
            <div className="space-y-3 text-sm">
              <p>
                <strong>{result.added}</strong> number{result.added === 1 ? "" : "s"} added to the pool{result.skippedCount ? `, ${result.skippedCount} not added` : ""}.
              </p>
              {result.columns.some((c) => c.field) && (
                <p className="text-xs text-muted-foreground">
                  Columns used:{" "}
                  {result.columns
                    .filter((c) => c.field)
                    .map((c) => `${c.heading} → ${FIELD_LABELS[c.field!]}`)
                    .join(" · ")}
                </p>
              )}
              {result.skipped.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                  {result.skipped.map((s) => (
                    <li key={`${s.line}-${s.text}`}>
                      <span className="text-muted-foreground">Row {s.line}:</span> <span className="font-mono">{s.text}</span> — {s.reason}
                    </li>
                  ))}
                  {result.skippedCount > result.skipped.length && <li className="text-muted-foreground">…and {result.skippedCount - result.skipped.length} more</li>}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) setFile(f);
                }}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
              >
                <Upload className="size-5" />
                {file ? <span className="font-medium text-foreground">{file.name}</span> : <span>Drop the file here, or click to choose</span>}
                <span className="text-xs">.xlsx or .csv · up to 5,000 rows · 10 MB</span>
              </button>
              <input
                ref={input}
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button type="button" onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
                <Download className="size-3.5" /> Download an example file
              </button>
            </div>
          )}
          <DialogFooter>
            {result ? (
              <>
                <Button variant="outline" onClick={() => close(false)}>
                  Close
                </Button>
                {result.added > 0 && <Button onClick={showBatch}>Show the imported numbers</Button>}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => close(false)} disabled={upload.pending}>
                  Cancel
                </Button>
                <Button loading={upload.pending} disabled={!file} onClick={() => void submit()}>
                  Import
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
