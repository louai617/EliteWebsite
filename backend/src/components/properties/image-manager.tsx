"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Loader2, Star, Trash2, Upload } from "lucide-react";
import { addImageUrlAction, removeImageAction, reorderImagesAction, setPrimaryImageAction, uploadImageAction } from "@/actions/properties";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PropertyImage } from "@/components/shared/property-image";

interface Img {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export function ImageManager({ propertyId, images }: { propertyId: string; images: Img[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const ordered = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  const addUrl = useAction(addImageUrlAction, { onSuccess: () => setUrl("") });
  const remove = useAction(removeImageAction);
  const primary = useAction(setPrimaryImageAction);
  const reorder = useAction(reorderImagesAction, { silent: true });
  const busy = addUrl.pending || remove.pending || primary.pending || reorder.pending || uploading;

  const move = (index: number, delta: number) => {
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    void reorder.run({ propertyId, imageIds: next.map((i) => i.id) });
  };

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    startUpload(async () => {
      let ok = 0;
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("propertyId", propertyId);
        fd.set("file", file);
        try {
          const result = await uploadImageAction(fd);
          if (result.ok) ok += 1;
          else toast.error(`${file.name}: ${result.error}`);
        } catch {
          toast.error(`${file.name}: upload failed (max 8 MB).`);
        }
      }
      if (ok) toast.success(`${ok} photo${ok === 1 ? "" : "s"} uploaded`);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ImagePlus /> Manage photos
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Photos</DialogTitle>
            <DialogDescription>The cover photo is shown in lists and on the public site. Use the arrows to change the order.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (url.trim()) void addUrl.run({ propertyId, url: url.trim() });
              }}
            >
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste an image URL (https://…)" className="pl-8" aria-label="Image URL" />
              </div>
              <Button type="submit" variant="secondary" loading={addUrl.pending} disabled={!url.trim()}>
                Add
              </Button>
            </form>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>
              <Upload /> Upload
            </Button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => upload(e.target.files)} />
          </div>

          {ordered.length === 0 ? (
            <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">No photos yet — add a URL or upload JPG/PNG/WebP files up to 8 MB.</p>
          ) : (
            <ul className={cn("grid max-h-[55vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-3", busy && "pointer-events-none opacity-70")}>
              {ordered.map((img, i) => (
                <li key={img.id} className="overflow-hidden rounded-md border bg-card">
                  <div className="relative">
                    <PropertyImage src={img.url} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full" />
                    {img.isPrimary && (
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[11px] font-medium shadow-sm">
                        <Star className="size-3 fill-gold text-gold" /> Cover
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 p-1.5">
                    <div className="flex">
                      <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-xs" disabled={i === ordered.length - 1} onClick={() => move(i, 1)} aria-label="Move later">
                        <ArrowDown />
                      </Button>
                    </div>
                    <div className="flex">
                      {!img.isPrimary && (
                        <Button variant="ghost" size="xs" onClick={() => void primary.run({ imageId: img.id })}>
                          Make cover
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive" onClick={() => void remove.run({ imageId: img.id })} aria-label="Remove photo">
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {busy && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
