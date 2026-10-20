"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type HTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Download, GripVertical, ImagePlus, Link2, Loader2, RotateCw, Star, Trash2, X } from "lucide-react";
import { addImageUrlAction, removeImageAction, reorderImagesAction, setPrimaryImageAction } from "@/actions/properties";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { isImageFile, makePreview, MAX_INPUT_BYTES, MAX_PHOTOS, PHOTO_ACCEPT, PhotoUploadError, preparePhoto, runQueue, uploadPhoto, type UploadedPhoto } from "@/lib/photo-upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PropertyImage } from "@/components/shared/property-image";

const GOOD_EDGE = 1600;
const CONCURRENCY = 3;

export interface SavedPhoto {
  id: string;
  url: string;
  thumbUrl?: string | null;
  blurDataUrl?: string | null;
  width?: number | null;
  height?: number | null;
  isPrimary: boolean;
  sortOrder: number;
  /** A clean original (no watermark) is kept and can be downloaded. */
  hasOriginal?: boolean;
}

const lowRes = (p: { width?: number | null; height?: number | null }) => p.width != null && p.height != null && Math.max(p.width, p.height) < GOOD_EDGE;

/** Picks image files out of a drop / paste / file input, with friendly limits. */
function pickFiles(list: FileList | File[] | null | undefined, room: number) {
  const files = Array.from(list ?? []);
  const images = files.filter(isImageFile);
  if (images.length < files.length) toast.error("Only photos can be added here (JPG, PNG, WebP, AVIF or HEIC).");
  const sized = images.filter((f) => f.size <= MAX_INPUT_BYTES);
  if (sized.length < images.length) toast.error("Some files are larger than 40 MB and were skipped.");
  if (sized.length > room) toast.error(room > 0 ? `Only ${room} more photo${room === 1 ? "" : "s"} can be added (max ${MAX_PHOTOS}).` : `A listing can have at most ${MAX_PHOTOS} photos.`);
  return sized.slice(0, Math.max(0, room));
}

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

/** Paste photos from the clipboard while the uploader is on screen (not while typing). */
function usePastePhotos(onFiles: (files: File[]) => unknown, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter(isImageFile);
      if (!files.length) return;
      e.preventDefault();
      onFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles, enabled]);
}

function DropZone({ onFiles, compact, disabled, children }: { onFiles: (files: FileList) => void; compact?: boolean; disabled?: boolean; children?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && (e.preventDefault(), input.current?.click())}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "aspect-[4/3] p-3" : "px-6 py-10",
        over ? "border-gold bg-gold/5" : "border-border bg-muted/30 hover:border-gold/60 hover:bg-muted/50",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <ImagePlus className={cn("text-muted-foreground", compact ? "size-5" : "size-7")} />
      {children ?? (
        <>
          <p className="text-sm font-medium">{compact ? "Add photos" : "Drop photos here or click to choose"}</p>
          {!compact && <p className="text-xs text-muted-foreground">JPG, PNG, WebP or HEIC · up to {MAX_PHOTOS} photos · you can also paste (Ctrl/⌘ V)</p>}
        </>
      )}
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

interface TileProps {
  src: string | null;
  blur?: string | null;
  index: number;
  total: number;
  cover?: boolean;
  low?: boolean;
  progress?: number | null;
  status?: "queued" | "preparing" | "uploading" | "processing" | "error";
  error?: string;
  draggable?: boolean;
  dragging?: boolean;
  onMove?: (delta: number) => void;
  onCover?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
  /** Link to download the clean original (no watermark). */
  originalHref?: string;
  dragProps?: HTMLAttributes<HTMLLIElement>;
}

function PhotoTile({ src, blur, index, total, cover, low, progress, status, error, draggable, dragging, onMove, onCover, onRemove, onRetry, originalHref, dragProps }: TileProps) {
  const busy = status === "queued" || status === "preparing" || status === "uploading" || status === "processing";
  return (
    <li
      draggable={draggable}
      {...dragProps}
      className={cn("group relative overflow-hidden rounded-lg border bg-card shadow-xs transition", dragging && "opacity-40", draggable && "cursor-grab active:cursor-grabbing")}
    >
      <div className="relative">
        <PropertyImage src={src} blur={blur} alt={`Photo ${index + 1}`} className="aspect-[4/3] w-full" iconClassName="size-6" />
        <span className="tabular absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 text-[11px] font-medium text-white">{index + 1}</span>
        {cover && (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold shadow-sm">
            <Star className="size-3 fill-gold text-gold" /> Cover
          </span>
        )}
        {low && !busy && status !== "error" && (
          <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900" title="Under 1600 px: may look soft on large screens and portals">
            <AlertTriangle className="size-3" /> Low res
          </span>
        )}
        {draggable && (
          <span className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 rounded bg-white/90 p-0.5 text-muted-foreground shadow-sm group-hover:block" aria-hidden="true">
            <GripVertical className="size-4" />
          </span>
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-white">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-xs font-medium">
              {status === "queued" ? "Waiting…" : status === "preparing" ? "Preparing…" : status === "processing" ? "Optimizing…" : `${Math.round((progress ?? 0) * 100)}%`}
            </span>
            {status === "uploading" && (
              <div className="h-1 w-3/4 overflow-hidden rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/70 p-2 text-center text-white">
            <p className="line-clamp-3 text-xs">{error}</p>
            {onRetry && (
              <Button type="button" size="xs" variant="secondary" onClick={onRetry}>
                <RotateCw /> Retry
              </Button>
            )}
          </div>
        )}
      </div>
      {!busy && (onMove || onCover || onRemove) && (
        <div className="flex items-center justify-between gap-1 p-1">
          <div className="flex">
            {onMove && (
              <>
                <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move earlier">
                  <ArrowLeft />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move later">
                  <ArrowRight />
                </Button>
              </>
            )}
          </div>
          <div className="flex">
            {originalHref && (
              <Button asChild variant="ghost" size="icon-xs">
                <a href={originalHref} download title="Download the original (no watermark)" aria-label="Download original photo">
                  <Download />
                </a>
              </Button>
            )}
            {onCover && !cover && status !== "error" && (
              <Button type="button" variant="ghost" size="xs" onClick={onCover}>
                <Star /> Cover
              </Button>
            )}
            {onRemove && (
              <Button type="button" variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive" onClick={onRemove} aria-label="Remove photo">
                {status === "error" ? <X /> : <Trash2 />}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** HTML5 drag-to-reorder over a list of keys (arrows stay available for keyboard / touch). */
function useDragOrder(keys: string[], onReorder: (next: string[]) => void, enabled: boolean) {
  const [dragging, setDragging] = useState<string | null>(null);
  const props = (key: string): HTMLAttributes<HTMLLIElement> =>
    enabled
      ? {
          onDragStart: (e) => {
            setDragging(key);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", key);
          },
          onDragEnd: () => setDragging(null),
          onDragOver: (e) => {
            if (dragging && dragging !== key) e.preventDefault();
          },
          onDrop: (e) => {
            if (!dragging || dragging === key) return;
            e.preventDefault();
            const next = keys.filter((k) => k !== dragging);
            next.splice(next.indexOf(key) + (keys.indexOf(dragging) < keys.indexOf(key) ? 1 : 0), 0, dragging);
            setDragging(null);
            onReorder(next);
          },
        }
      : {};
  return { dragging, props };
}

const move = <T,>(list: T[], index: number, delta: number) => {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  return next;
};

function Header({ count, children }: { count: number; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        <span className="tabular font-medium text-foreground">
          {count} / {MAX_PHOTOS}
        </span>{" "}
        photos · the first is the cover · drag to reorder · landscape, 1600 px+ looks best
      </p>
      {children}
    </div>
  );
}

// ───────────────────────────── Existing listing: upload right away ─────────────────────────────

interface Pending {
  key: string;
  file: File;
  preview: string;
  status: "queued" | "preparing" | "uploading" | "processing" | "error";
  progress: number;
  error?: string;
  retryable?: boolean;
}

/** Manage the photos of a saved listing: uploads start as soon as photos are added. */
export function PhotoManager({ propertyId, images, onBusyChange }: { propertyId: string; images: SavedPhoto[]; onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploaded, setUploaded] = useState<(SavedPhoto & { lowRes?: boolean })[]>([]);
  const [order, setOrder] = useState<string[] | null>(null);
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  const remove = useAction(removeImageAction, { silent: true });
  const primary = useAction(setPrimaryImageAction);
  const reorder = useAction(reorderImagesAction, { silent: true });
  const addUrl = useAction(addImageUrlAction, { onSuccess: () => (setUrl(""), setShowUrl(false), router.refresh()) });

  // Server photos, plus ones uploaded in this session that the page hasn't refreshed in yet.
  const saved = useMemo(() => {
    const known = new Set(images.map((i) => i.id));
    const all = [...[...images].sort((a, b) => a.sortOrder - b.sortOrder), ...uploaded.filter((u) => !known.has(u.id))];
    if (!order) return all;
    const pos = new Map(order.map((id, i) => [id, i]));
    return [...all].sort((a, b) => (pos.get(a.id) ?? 1e6 + a.sortOrder) - (pos.get(b.id) ?? 1e6 + b.sortOrder));
  }, [images, uploaded, order]);

  const uploading = pending.some((p) => p.status !== "error");
  useEffect(() => onBusyChange?.(uploading), [uploading, onBusyChange]);
  // Free preview memory when tiles go away.
  const previews = useRef(new Set<string>());
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const patch = useCallback((key: string, p: Partial<Pending>) => setPending((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x))), []);

  const start = useCallback(
    async (items: Pending[]) => {
      let ok = 0;
      await runQueue(items, CONCURRENCY, async (item) => {
        try {
          patch(item.key, { status: "preparing", progress: 0, error: undefined });
          const blob = await preparePhoto(item.file);
          patch(item.key, { status: "uploading" });
          const photo: UploadedPhoto = await uploadPhoto(propertyId, blob, item.file.name, (progress) =>
            patch(item.key, progress >= 1 ? { status: "processing", progress } : { progress }),
          );
          ok++;
          setUploaded((list) => [...list, { ...photo, blurDataUrl: null }]);
          setPending((list) => list.filter((x) => x.key !== item.key));
          URL.revokeObjectURL(item.preview);
          previews.current.delete(item.preview);
        } catch (error) {
          patch(item.key, { status: "error", error: error instanceof Error ? error.message : "Upload failed", retryable: !(error instanceof PhotoUploadError) || error.retryable });
        }
      });
      if (ok) {
        toast.success(`${ok} photo${ok === 1 ? "" : "s"} added`);
        router.refresh();
      }
    },
    [propertyId, router, patch],
  );

  // Photos on screen, for the 40-photo limit inside the async add (kept current after each render).
  const count = useRef(0);
  useEffect(() => {
    count.current = saved.length + pending.length;
  });
  const add = useCallback(
    async (list: FileList | File[]) => {
      const files = pickFiles(list, MAX_PHOTOS - count.current);
      if (!files.length) return;
      count.current += files.length;
      const items: Pending[] = await Promise.all(
        files.map(async (file) => {
          const preview = await makePreview(file);
          previews.current.add(preview);
          return { key: crypto.randomUUID(), file, preview, status: "queued" as const, progress: 0 };
        }),
      );
      setPending((p) => [...p, ...items]);
      void start(items);
    },
    [start],
  );
  usePastePhotos(add, true);

  const saveOrder = (ids: string[]) => {
    setOrder(ids);
    void reorder.run({ propertyId, imageIds: ids }).then((r) => r?.ok && router.refresh());
  };
  const savedIds = saved.map((s) => s.id);
  const drag = useDragOrder(savedIds, saveOrder, !uploading && saved.length > 1);
  const cover = saved.find((s) => s.isPrimary)?.id ?? saved[0]?.id;

  return (
    <div className="space-y-3">
      <Header count={saved.length + pending.length}>
        <Button type="button" variant="ghost" size="xs" onClick={() => setShowUrl((v) => !v)}>
          <Link2 /> Add by URL
        </Button>
      </Header>
      {showUrl && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) void addUrl.run({ propertyId, url: url.trim() });
          }}
        >
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (a photo already online)" aria-label="Photo URL" autoFocus />
          <Button type="submit" variant="secondary" loading={addUrl.pending} disabled={!url.trim()}>
            Add
          </Button>
        </form>
      )}
      {saved.length + pending.length === 0 ? (
        <DropZone onFiles={(f) => void add(f)} />
      ) : (
        <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", (remove.pending || reorder.pending) && "opacity-80")}>
          {saved.map((img, i) => (
            <PhotoTile
              key={img.id}
              src={img.thumbUrl ?? img.url}
              blur={img.blurDataUrl}
              index={i}
              total={saved.length}
              cover={img.id === cover}
              low={Boolean("lowRes" in img && img.lowRes) || lowRes(img)}
              draggable={!uploading && saved.length > 1}
              dragging={drag.dragging === img.id}
              dragProps={drag.props(img.id)}
              onMove={uploading ? undefined : (d) => saveOrder(move(savedIds, i, d))}
              originalHref={img.hasOriginal ? `/api/properties/${encodeURIComponent(propertyId)}/photos/${encodeURIComponent(img.id)}/original` : undefined}
              onCover={() => void primary.run({ imageId: img.id }).then((r) => r?.ok && router.refresh())}
              onRemove={() => {
                setUploaded((list) => list.filter((u) => u.id !== img.id));
                setOrder((o) => o?.filter((id) => id !== img.id) ?? null);
                void remove.run({ imageId: img.id }).then((r) => {
                  if (r?.ok) toast.success("Photo removed");
                  router.refresh();
                });
              }}
            />
          ))}
          {pending.map((p, i) => (
            <PhotoTile
              key={p.key}
              src={p.preview}
              index={saved.length + i}
              total={saved.length + pending.length}
              status={p.status}
              progress={p.progress}
              error={p.error}
              onRetry={p.retryable ? () => void start([p]) : undefined}
              onRemove={() => {
                URL.revokeObjectURL(p.preview);
                previews.current.delete(p.preview);
                setPending((list) => list.filter((x) => x.key !== p.key));
              }}
            />
          ))}
          {saved.length + pending.length < MAX_PHOTOS && (
            <li>
              <DropZone onFiles={(f) => void add(f)} compact />
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** "Manage photos" button + dialog on the property page (can't be closed mid-upload). */
export function PhotosButton({ propertyId, images }: { propertyId: string; images: SavedPhoto[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant={images.length ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
        <ImagePlus /> {images.length ? `Manage photos (${images.length})` : "Add photos"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && busy) return void toast.info("Photos are still uploading — this closes when they're done.");
          setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Photos</DialogTitle>
            <DialogDescription>Photos are optimized automatically: straightened, location data removed, resized and compressed for fast loading.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <PhotoManager propertyId={propertyId} images={images} onBusyChange={setBusy} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ───────────────────────────── New listing: pick now, upload after saving ─────────────────────────────

export interface StagedPhoto {
  key: string;
  file: File;
  preview: string;
}

/** Photo picker for the "New property" form. The first photo is the cover. */
export function StagedPhotos({ value, onChange, disabled }: { value: StagedPhoto[]; onChange: (next: StagedPhoto[]) => void; disabled?: boolean }) {
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  const add = useCallback(
    async (list: FileList | File[]) => {
      const files = pickFiles(list, MAX_PHOTOS - latest.current.length);
      if (!files.length) return;
      const picked = await Promise.all(files.map(async (file) => ({ key: crypto.randomUUID(), file, preview: await makePreview(file) })));
      onChange([...latest.current, ...picked]);
    },
    [onChange],
  );
  usePastePhotos(add, !disabled);
  const keys = value.map((v) => v.key);
  const reorderTo = (next: string[]) => onChange(next.map((k) => value.find((v) => v.key === k)!));
  const drag = useDragOrder(keys, reorderTo, !disabled && value.length > 1);
  const drop = (key: string) => {
    const item = value.find((v) => v.key === key);
    if (item) URL.revokeObjectURL(item.preview);
    onChange(value.filter((v) => v.key !== key));
  };

  return (
    <div className="space-y-3 sm:col-span-2">
      <Header count={value.length} />
      {value.length === 0 ? (
        <DropZone onFiles={(f) => void add(f)} disabled={disabled} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {value.map((p, i) => (
            <PhotoTile
              key={p.key}
              src={p.preview}
              index={i}
              total={value.length}
              cover={i === 0}
              draggable={!disabled && value.length > 1}
              dragging={drag.dragging === p.key}
              dragProps={drag.props(p.key)}
              onMove={disabled ? undefined : (d) => onChange(move(value, i, d))}
              onCover={disabled ? undefined : () => onChange([p, ...value.filter((v) => v.key !== p.key)])}
              onRemove={disabled ? undefined : () => drop(p.key)}
            />
          ))}
          {value.length < MAX_PHOTOS && !disabled && (
            <li>
              <DropZone onFiles={(f) => void add(f)} compact />
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Uploads the photos picked in the "New property" form once the listing exists, keeping the
 * chosen order (the first photo is the cover). Returns how many failed.
 */
export async function uploadStagedPhotos(propertyId: string, photos: StagedPhoto[], onProgress: (done: number, total: number) => void) {
  const ids: (string | null)[] = photos.map(() => null);
  let done = 0;
  const errors: string[] = [];
  onProgress(0, photos.length);
  await runQueue(photos, CONCURRENCY, async (p, i) => {
    try {
      const blob = await preparePhoto(p.file);
      ids[i] = (await uploadPhoto(propertyId, blob, p.file.name, () => undefined)).id;
    } catch (error) {
      errors.push(`${p.file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
    }
    onProgress(++done, photos.length);
  });
  const ordered = ids.filter((id): id is string => Boolean(id));
  if (ordered.length > 1) {
    await reorderImagesAction({ propertyId, imageIds: ordered }).catch(() => undefined);
    await setPrimaryImageAction({ imageId: ordered[0] }).catch(() => undefined);
  }
  photos.forEach((p) => URL.revokeObjectURL(p.preview));
  return errors;
}
