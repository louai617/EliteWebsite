"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FilePlus2, FileSignature, Printer } from "lucide-react";
import { generateContractAction } from "@/actions/contracts";
import { useAction } from "@/hooks/use-action";
import { AUTO_PLACEHOLDERS, placeholdersIn, type ContractField } from "@/lib/contract-format";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface ContractTemplateOption {
  id: string;
  name: string;
  description: string | null;
  body: string;
  fields: ContractField[];
}

export interface ContractRow {
  id: string;
  reference: string;
  title: string;
  templateName: string;
  createdAt: Date | string;
  createdBy: { name: string } | null;
}

function GenerateDialog({ open, onOpenChange, dealId, templates, autoValues }: { open: boolean; onOpenChange: (o: boolean) => void; dealId: string; templates: ContractTemplateOption[]; autoValues: Record<string, string> }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAuto, setShowAuto] = useState(false);
  const template = templates.find((t) => t.id === templateId);
  const generate = useAction(generateContractAction, { onSuccess: (c) => router.push(`/contracts/${c.id}`) });

  const used = useMemo(() => new Set(template ? placeholdersIn(template.body) : []), [template]);
  const autoUsed = AUTO_PLACEHOLDERS.filter((p) => used.has(p.key));
  const missingAuto = autoUsed.filter((p) => !autoValues[p.key]);

  const submit = async () => {
    if (!template) return;
    const result = await generate.run({ dealId, templateId: template.id, values });
    if (result && !result.ok && result.fieldErrors) {
      setErrors(Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k.replace(/^values\./, ""), v[0]])));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !generate.pending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate contract</DialogTitle>
          <DialogDescription>The client, property, price and agent details are filled in from the deal. Fill in the rest below.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select
            value={templateId}
            onValueChange={(v) => {
              setTemplateId(v);
              setErrors({});
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {template?.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
        </div>

        {template && (
          <>
            {template.fields.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {template.fields.map((f) => (
                  <div key={f.key} className={f.type === "textarea" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                    <Label htmlFor={`cf-${f.key}`}>
                      {f.label} {f.required && <span className="text-destructive">*</span>}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea id={`cf-${f.key}`} rows={3} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} aria-invalid={Boolean(errors[f.key])} />
                    ) : (
                      <Input
                        id={`cf-${f.key}`}
                        type={f.type === "date" ? "date" : "text"}
                        inputMode={f.type === "number" || f.type === "money" ? "decimal" : undefined}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        aria-invalid={Boolean(errors[f.key])}
                      />
                    )}
                    {errors[f.key] && <p className="text-xs text-destructive">{errors[f.key]}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-md border bg-muted/30">
              <button type="button" onClick={() => setShowAuto((s) => !s)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium">
                Filled from the deal ({autoUsed.length})
                <ChevronDown className={`size-4 transition-transform ${showAuto ? "rotate-180" : ""}`} />
              </button>
              {showAuto && (
                <dl className="grid gap-x-4 gap-y-1.5 border-t px-3 py-2.5 text-xs sm:grid-cols-2">
                  {autoUsed.map((p) => (
                    <div key={p.key} className="min-w-0">
                      <dt className="text-muted-foreground">{p.label}</dt>
                      <dd className={autoValues[p.key] ? "truncate font-medium" : "text-amber-700"}>{autoValues[p.key] || "Missing — left blank to fill by hand"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {missingAuto.length > 0 && (
              <p className="text-xs text-amber-700">
                Missing on the deal: {missingAuto.map((p) => p.label.toLowerCase()).join(", ")}. They&apos;ll print as blank lines — or add them first (e.g. upload the client&apos;s QID with its number).
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generate.pending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={generate.pending} disabled={!template}>
            <FileSignature /> Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContractsPanel({ dealId, contracts, templates, autoValues, canGenerate }: { dealId: string; contracts: ContractRow[]; templates: ContractTemplateOption[]; autoValues: Record<string, string>; canGenerate: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      {contracts.length ? (
        <ul className="divide-y">
          {contracts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <FileSignature className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <Link href={`/contracts/${c.id}`} className="block truncate text-sm font-medium hover:underline">
                  {c.reference} · {c.templateName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatDate(c.createdAt)}
                  {c.createdBy ? ` · ${c.createdBy.name}` : ""}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/contracts/${c.id}`}>
                  <Printer /> Open
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No contract generated yet.</p>
      )}
      {canGenerate &&
        (templates.length ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <FilePlus2 /> Generate contract
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">No active contract template for this deal type. An admin can add one under Settings → Contracts.</p>
        ))}
      {canGenerate && templates.length > 0 && <GenerateDialog open={open} onOpenChange={setOpen} dealId={dealId} templates={templates} autoValues={autoValues} />}
    </div>
  );
}
