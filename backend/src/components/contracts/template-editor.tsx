"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Save, Trash2 } from "lucide-react";
import type { DealType } from "@/generated/prisma/enums";
import { deleteContractTemplateAction, saveContractTemplateAction } from "@/actions/contracts";
import { useAction } from "@/hooks/use-action";
import { AUTO_PLACEHOLDERS, fillPlaceholders, renderContractHtml, type ContractField } from "@/lib/contract-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/shared/confirm-button";

interface TemplateDraft {
  id?: string;
  name: string;
  description: string;
  dealType: DealType | null;
  isActive: boolean;
  fields: ContractField[];
  body: string;
}

const FIELD_TYPES: { value: ContractField["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "date", label: "Date" },
  { value: "money", label: "Amount (QAR)" },
  { value: "number", label: "Number" },
];

const SAMPLE_FIELD: Record<ContractField["type"], string> = { text: "Sample text", textarea: "Sample paragraph written by the agent.", date: "1 December 2026", money: "245,000", number: "4" };

function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 40) || "field";
}

export function TemplateEditor({ template }: { template: TemplateDraft }) {
  const router = useRouter();
  const [draft, setDraft] = useState<TemplateDraft>(template);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const save = useAction(saveContractTemplateAction, { onSuccess: (t) => (template.id ? router.refresh() : router.replace(`/settings/contracts/${t.id}`)) });

  const set = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setField = (i: number, patch: Partial<ContractField>) => set("fields", draft.fields.map((f, j) => (i === j ? { ...f, ...patch } : f)));

  const insert = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) return set("body", draft.body + token);
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? start;
    const next = draft.body.slice(0, start) + token + draft.body.slice(end);
    set("body", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const previewHtml = useMemo(() => {
    const sample = Object.fromEntries([...AUTO_PLACEHOLDERS.map((p) => [p.key, p.sample]), ...draft.fields.map((f) => [f.key, SAMPLE_FIELD[f.type]])]);
    return renderContractHtml(fillPlaceholders(draft.body, sample));
  }, [draft.body, draft.fields]);

  const submit = async () => {
    setErrors({});
    const result = await save.run({ ...draft, id: template.id, description: draft.description || null, dealType: draft.dealType ?? "ANY" } as never);
    if (result && !result.ok && result.fieldErrors) setErrors(result.fieldErrors);
  };
  const err = (key: string) => errors[key]?.[0];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name *</Label>
              <Input id="tpl-name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={120} aria-invalid={Boolean(err("name"))} />
              {err("name") && <p className="text-xs text-destructive">{err("name")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Used for</Label>
              <Select value={draft.dealType ?? "ANY"} onValueChange={(v) => set("dealType", v === "ANY" ? null : (v as DealType))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANY">Any deal</SelectItem>
                  <SelectItem value="SALE">Sales</SelectItem>
                  <SelectItem value="RENTAL">Rentals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Input id="tpl-desc" value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={300} placeholder="Shown to agents when they pick a template" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={draft.isActive} onCheckedChange={(v) => set("isActive", v)} /> Available to agents
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-col">
            <CardTitle>Fields agents fill in</CardTitle>
            <CardDescription>Everything about the parties, property, price and agent is filled automatically. Add only what changes per contract.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.fields.map((f, i) => (
              <div key={i} className="grid items-start gap-2 rounded-md border p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
                <div className="space-y-1">
                  <Input
                    value={f.label}
                    onChange={(e) => setField(i, { label: e.target.value, ...(f.key === slug(f.label) || !f.key ? { key: slug(e.target.value) } : {}) })}
                    placeholder="Label, e.g. Handover date"
                    aria-label="Field label"
                  />
                  {err(`fields.${i}.label`) && <p className="text-xs text-destructive">{err(`fields.${i}.label`)}</p>}
                </div>
                <div className="space-y-1">
                  <Input value={f.key} onChange={(e) => setField(i, { key: e.target.value.toLowerCase() })} className="font-mono text-xs" aria-label="Placeholder key" />
                  {err(`fields.${i}.key`) && <p className="text-xs text-destructive">{err(`fields.${i}.key`)}</p>}
                </div>
                <Select value={f.type} onValueChange={(v) => setField(i, { type: v as ContractField["type"] })}>
                  <SelectTrigger className="w-full" aria-label="Field type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex h-9 items-center gap-1.5 text-xs whitespace-nowrap">
                  <Switch checked={f.required} onCheckedChange={(v) => setField(i, { required: v })} /> Required
                </label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => insert(f.key)} aria-label={`Insert {{${f.key}}}`} title="Insert into the text">
                    <Plus />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => set("fields", draft.fields.filter((_, j) => j !== i))} aria-label="Remove field">
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => set("fields", [...draft.fields, { key: `field_${draft.fields.length + 1}`, label: "", type: "text", required: true }])}>
              <Plus /> Add field
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contract text</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
              <Eye /> {preview ? "Edit" : "Preview"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {preview ? (
              <div className="contract-body max-h-[70vh] overflow-y-auto rounded-md border bg-white p-6" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <Textarea ref={bodyRef} value={draft.body} onChange={(e) => set("body", e.target.value)} rows={28} className="font-mono text-[13px] leading-relaxed" aria-invalid={Boolean(err("body"))} spellCheck />
            )}
            {err("body") && <p className="text-xs text-destructive">{err("body")}</p>}
            <p className="text-xs text-muted-foreground">
              <code># Title</code>, <code>## Section</code>, <code>**bold**</code>, <code>- bullet</code>, <code>---</code> for a line, and <code>{"{{placeholder}}"}</code> for values. Missing values print as a blank line to fill by hand.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void submit()} loading={save.pending}>
            <Save /> Save template
          </Button>
          {template.id && (
            <ConfirmAction
              title="Delete this template?"
              description="If contracts were already generated from it, it is turned off instead so they keep their source."
              action={deleteContractTemplateAction}
              input={{ id: template.id }}
              onDone={() => router.push("/settings/contracts")}
            >
              <Button variant="outline">
                <Trash2 /> Delete
              </Button>
            </ConfirmAction>
          )}
        </div>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <CardHeader className="flex-col">
            <CardTitle>Filled automatically</CardTitle>
            <CardDescription>Click to insert at the cursor.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[60vh] space-y-1 overflow-y-auto">
            {AUTO_PLACEHOLDERS.map((p) => (
              <button key={p.key} type="button" onClick={() => insert(p.key)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent" disabled={preview}>
                <span className="block font-mono text-xs">{`{{${p.key}}}`}</span>
                <span className="block text-xs text-muted-foreground">{p.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
