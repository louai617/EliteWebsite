"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Box, ExternalLink, FileText, Film, LayoutPanelTop, Link2, Trash2, Upload } from "lucide-react";
import type { MediaKind } from "@/generated/prisma/enums";
import { addMediaLinkAction, deleteMediaAction, moveMediaAction } from "@/actions/media";
import { useAction } from "@/hooks/use-action";
import { parseMediaLink } from "@/lib/media-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmAction } from "@/components/shared/confirm-button";
import { cn } from "@/lib/utils";

export interface MediaRow {
  id: string;
  kind: MediaKind;
  title: string | null;
  url: string | null;
  provider: string;
  embedUrl: string | null;
  mimeType: string | null;
  size: number | null;
}

const KINDS: { kind: MediaKind; label: string; single: string; icon: typeof Film; upload: string | null; linkHint: string }[] = [
  { kind: "VIDEO", label: "Videos", single: "Video", icon: Film, upload: "MP4, MOV or WebM up to 200 MB", linkHint: "YouTube or Vimeo link" },
  { kind: "VIRTUAL_TOUR", label: "360° tours", single: "360° tour", icon: Box, upload: null, linkHint: "Matterport, Kuula or any tour link" },
  { kind: "FLOOR_PLAN", label: "Floor plans", single: "Floor plan", icon: LayoutPanelTop, upload: "JPG, PNG, WebP or PDF up to 15 MB", linkHint: "Link to an image or PDF" },
  { kind: "BROCHURE", label: "Brochure", single: "Brochure", icon: FileText, upload: "PDF up to 30 MB", linkHint: "Link to a PDF" },
];

const PROVIDER_LABEL: Record<string, string> = { youtube: "YouTube", vimeo: "Vimeo", matterport: "Matterport", kuula: "Kuula", link: "Link", file: "Uploaded file" };

function size(bytes: number | null) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Uploads the raw file with progress (XHR) to the streaming endpoint. */
function uploadWithProgress(propertyId: string, kind: MediaKind, title: string, file: File, onProgress: (p: number) => void) {
  return new Promise<{ ok: boolean; message?: string }>((resolve) => {
    const xhr = new XMLHttpRequest();
    const qs = new URLSearchParams({ kind, ...(title ? { title } : {}) });
    xhr.open("POST", `/api/media-upload/${propertyId}?${qs}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        resolve(json.ok ? { ok: true } : { ok: false, message: json.error?.message });
      } catch {
        resolve({ ok: false, message: `Upload failed (HTTP ${xhr.status}).` });
      }
    };
    xhr.onerror = () => resolve({ ok: false, message: "Network error — check your connection and try again." });
    xhr.send(file);
  });
}

function AddMedia({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<MediaKind>("VIDEO");
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const add = useAction(addMediaLinkAction, {
    onSuccess: () => {
      setUrl("");
      setTitle("");
      router.refresh();
    },
  });
  const meta = KINDS.find((k) => k.kind === kind)!;
  const canUpload = Boolean(meta.upload);
  const effectiveMode = canUpload ? mode : "link";
  const parsed = url ? parseMediaLink(url) : null;

  const upload = async () => {
    if (!file) return;
    setProgress(0);
    const result = await uploadWithProgress(propertyId, kind, title, file, setProgress);
    setProgress(null);
    if (result.ok) {
      toast.success(`${meta.single} uploaded`);
      setFile(null);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } else toast.error(result.message ?? "Upload failed.");
  };

  return (
    <div className="grid gap-3 rounded-md border border-dashed bg-muted/30 p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as MediaKind)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k.kind} value={k.kind}>
                {k.single}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canUpload && (
          <div className="flex gap-1 pt-1" role="tablist">
            {(["link", "upload"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={effectiveMode === m} onClick={() => setMode(m)} className={cn("flex-1 rounded px-2 py-1 text-xs", effectiveMode === m ? "bg-foreground text-background" : "hover:bg-accent")}>
                {m === "link" ? "Link" : "Upload"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {effectiveMode === "link" ? (
          <div className="space-y-1.5">
            <Label htmlFor="media-url">Link</Label>
            <Input key="media-url" id="media-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`https://… (${meta.linkHint})`} />
            {parsed && <p className="text-xs text-muted-foreground">{parsed.embedUrl ? `${PROVIDER_LABEL[parsed.provider]} — plays on the listing page` : "Shown as a link that opens in a new tab"}</p>}
            {url && !parsed && <p className="text-xs text-destructive">Use a full link starting with https://</p>}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="media-file">File ({meta.upload})</Label>
            <Input key="media-file" ref={fileRef} id="media-file" type="file" accept={kind === "VIDEO" ? "video/mp4,video/quicktime,video/webm" : kind === "BROCHURE" ? "application/pdf" : "image/jpeg,image/png,image/webp,application/pdf"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="cursor-pointer" />
            {progress !== null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="media-title">Title (optional)</Label>
            <Input id="media-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={kind === "FLOOR_PLAN" ? "e.g. Ground floor" : kind === "VIDEO" ? "e.g. Walkthrough" : ""} />
          </div>
          {effectiveMode === "link" ? (
            <Button size="sm" loading={add.pending} disabled={!parsed} onClick={() => void add.run({ propertyId, kind, url, title: title || null })}>
              <Link2 /> Add link
            </Button>
          ) : (
            <Button size="sm" loading={progress !== null} disabled={!file} onClick={() => void upload()}>
              <Upload /> {progress !== null ? `${progress}%` : "Upload"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Videos, 360° tours, floor plans and the brochure of a listing. */
export function MediaManager({ propertyId, media, canEdit }: { propertyId: string; media: MediaRow[]; canEdit: boolean }) {
  const router = useRouter();
  const move = useAction(moveMediaAction, { silent: true, onSuccess: () => router.refresh() });
  return (
    <div className="space-y-4">
      {KINDS.map(({ kind, label, single, icon: Icon }) => {
        const items = media.filter((m) => m.kind === kind);
        if (!items.length) return null;
        return (
          <div key={kind}>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Icon className="size-3.5" /> {label}
            </p>
            <ul className="divide-y rounded-md border">
              {items.map((m, i) => {
                const href = m.provider === "file" ? `/api/media/${m.id}` : (m.url ?? "#");
                return (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.title ?? (m.provider === "file" ? `${single} file` : m.url)}</p>
                      <p className="text-xs text-muted-foreground">
                        {PROVIDER_LABEL[m.provider] ?? m.provider}
                        {m.size ? ` · ${size(m.size)}` : ""}
                        {m.embedUrl || m.provider === "file" ? " · shown on the website" : " · opens as a link"}
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="icon-xs" aria-label="Open">
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                      </a>
                    </Button>
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={i === 0 || move.pending} onClick={() => void move.run({ id: m.id, direction: "up" })}>
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon-xs" aria-label="Move down" disabled={i === items.length - 1 || move.pending} onClick={() => void move.run({ id: m.id, direction: "down" })}>
                          <ArrowDown />
                        </Button>
                        <ConfirmAction title="Remove this media?" description="It disappears from the listing on the website. Uploaded files are deleted." action={deleteMediaAction} input={{ id: m.id }} confirmLabel="Remove">
                          <Button variant="ghost" size="icon-xs" aria-label="Remove">
                            <Trash2 />
                          </Button>
                        </ConfirmAction>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {!media.length && <p className="text-sm text-muted-foreground">No videos, tours, floor plans or brochure yet.</p>}
      {canEdit && <AddMedia propertyId={propertyId} />}
    </div>
  );
}
