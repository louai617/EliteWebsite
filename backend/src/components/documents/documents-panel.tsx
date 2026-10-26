"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, FileText, ImageIcon, Paperclip, ShieldCheck, Trash2, Upload } from "lucide-react";
import type { DocumentKind } from "@/generated/prisma/enums";
import type { DocumentTarget } from "@/schemas/document";
import { deleteDocumentAction, uploadDocumentAction } from "@/actions/documents";
import { DOCUMENT_KIND_META } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ConfirmAction } from "@/components/shared/confirm-button";

export interface DocumentRow {
  id: string;
  kind: DocumentKind;
  title: string | null;
  number: string | null;
  expiresAt: Date | string | null;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedByClient: boolean;
  createdAt: Date | string;
  uploadedBy: { name: string } | null;
}

const ID_KINDS: DocumentKind[] = ["QID", "PASSPORT", "VISA", "TRADE_LICENSE"];
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function expiryState(expiresAt: Date | string | null) {
  if (!expiresAt) return null;
  const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return { label: "Expired", className: "text-rose-700" };
  if (days < 60) return { label: `Expires ${formatDate(expiresAt)}`, className: "text-amber-700" };
  return { label: `Valid until ${formatDate(expiresAt)}`, className: "text-muted-foreground" };
}

/** Uploads one file; used by the panel and by the lead stage dialogs. */
export function useDocumentUpload(target: DocumentTarget, targetId: string, onDone?: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const upload = (input: { kind: DocumentKind; file: File; title?: string; number?: string; expiresAt?: string }) =>
    new Promise<boolean>((resolve) => {
      start(async () => {
        const fd = new FormData();
        fd.set("target", target);
        fd.set("targetId", targetId);
        fd.set("kind", input.kind);
        if (input.title) fd.set("title", input.title);
        if (input.number) fd.set("number", input.number);
        if (input.expiresAt) fd.set("expiresAt", input.expiresAt);
        fd.set("file", input.file);
        try {
          const result = await uploadDocumentAction(fd);
          if (result.ok) {
            toast.success(`${DOCUMENT_KIND_META[input.kind].label} uploaded`);
            onDone?.();
            router.refresh();
            resolve(true);
          } else {
            toast.error(result.fieldErrors?.file?.[0] ?? result.error);
            resolve(false);
          }
        } catch {
          toast.error("Upload failed — files must be PDF, JPG, PNG or WebP and 10 MB or smaller.");
          resolve(false);
        }
      });
    });
  return { upload, pending };
}

/** A single "attach this kind of document" button (file picker opens directly). */
export function AttachButton({ target, targetId, kind, label, variant = "outline", onDone }: { target: DocumentTarget; targetId: string; kind: DocumentKind; label?: string; variant?: "outline" | "default"; onDone?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const { upload, pending } = useDocumentUpload(target, targetId, onDone);
  return (
    <>
      <Button type="button" variant={variant} size="sm" loading={pending} onClick={() => ref.current?.click()}>
        <Paperclip /> {label ?? `Attach ${DOCUMENT_KIND_META[kind].label.toLowerCase()}`}
      </Button>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload({ kind, file });
        }}
      />
    </>
  );
}

function UploadForm({ target, targetId, kinds, defaultKind }: { target: DocumentTarget; targetId: string; kinds: DocumentKind[]; defaultKind: DocumentKind }) {
  const [kind, setKind] = useState<DocumentKind>(defaultKind);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const reset = () => {
    setFile(null);
    setTitle("");
    setNumber("");
    setExpiresAt("");
    if (fileRef.current) fileRef.current.value = "";
  };
  const { upload, pending } = useDocumentUpload(target, targetId, reset);
  const isId = ID_KINDS.includes(kind);

  return (
    <form
      className="grid gap-3 rounded-md border border-dashed bg-muted/30 p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return toast.error("Choose a file first.");
        void upload({ kind, file, title, number: isId ? number : undefined, expiresAt: isId ? expiresAt : undefined });
      }}
    >
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as DocumentKind)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kinds.map((k) => (
              <SelectItem key={k} value={k}>
                {DOCUMENT_KIND_META[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`doc-file-${targetId}`}>File (PDF or photo, max 10 MB)</Label>
        <Input ref={fileRef} id={`doc-file-${targetId}`} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="cursor-pointer" />
      </div>
      {isId ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`doc-number-${targetId}`}>Document number</Label>
            <Input id={`doc-number-${targetId}`} value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} placeholder={kind === "QID" ? "e.g. 28463400000" : "e.g. N1234567"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`doc-expiry-${targetId}`}>Expiry date</Label>
            <Input id={`doc-expiry-${targetId}`} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`doc-title-${targetId}`}>Description (optional)</Label>
          <Input id={`doc-title-${targetId}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Signed at the viewing on 12 Oct" />
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" loading={pending} disabled={!file}>
          <Upload /> Upload
        </Button>
      </div>
    </form>
  );
}

export function DocumentsList({ documents, canDelete, emptyText = "No documents yet." }: { documents: DocumentRow[]; canDelete: boolean; emptyText?: string }) {
  if (!documents.length) return <p className="py-2 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="divide-y">
      {documents.map((d) => {
        const Icon = d.mimeType === "application/pdf" ? FileText : ImageIcon;
        const expiry = expiryState(d.expiresAt);
        return (
          <li key={d.id} className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <EnumBadge meta={DOCUMENT_KIND_META} value={d.kind} />
                {d.number && <span className="font-mono text-xs">{d.number}</span>}
                {d.uploadedByClient && (
                  <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700">
                    <ShieldCheck className="size-3" /> From the client
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm">{d.title ?? d.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {size(d.size)} · {formatDate(d.createdAt)}
                {d.uploadedBy ? ` · ${d.uploadedBy.name}` : ""}
                {expiry && <span className={cn("ml-1", expiry.className)}>· {expiry.label}</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button asChild variant="ghost" size="icon-xs" aria-label={`View ${d.fileName}`}>
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer">
                  <Eye />
                </a>
              </Button>
              <Button asChild variant="ghost" size="icon-xs" aria-label={`Download ${d.fileName}`}>
                <a href={`/api/documents/${d.id}?download=1`}>
                  <Download />
                </a>
              </Button>
              {canDelete && (
                <ConfirmAction title="Delete this document?" description={`${DOCUMENT_KIND_META[d.kind].label} — ${d.fileName}. The deletion is recorded in the activity log.`} action={deleteDocumentAction} input={{ id: d.id }}>
                  <Button variant="ghost" size="icon-xs" aria-label={`Delete ${d.fileName}`}>
                    <Trash2 />
                  </Button>
                </ConfirmAction>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Card body: list + upload form. */
export function DocumentsPanel({
  target,
  targetId,
  documents,
  kinds,
  defaultKind,
  canDelete,
  emptyText,
}: {
  target: DocumentTarget;
  targetId: string;
  documents: DocumentRow[];
  kinds: DocumentKind[];
  defaultKind?: DocumentKind;
  canDelete: boolean;
  emptyText?: string;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      <DocumentsList documents={documents} canDelete={canDelete} emptyText={emptyText} />
      {adding ? (
        <UploadForm target={target} targetId={targetId} kinds={kinds} defaultKind={defaultKind ?? kinds[0]} />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Upload /> Upload document
        </Button>
      )}
    </div>
  );
}
