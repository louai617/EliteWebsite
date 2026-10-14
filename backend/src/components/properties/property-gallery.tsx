"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { PropertyImage } from "@/components/shared/property-image";

export function PropertyGallery({ images, title }: { images: { id: string; url: string; isPrimary: boolean }[]; title: string }) {
  const ordered = [...images.filter((i) => i.isPrimary), ...images.filter((i) => !i.isPrimary)];
  const [index, setIndex] = useState(0);
  const current = ordered[index];

  if (ordered.length === 0) {
    return (
      <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card text-muted-foreground">
        <Images className="size-6" />
        <p className="text-sm">No photos yet</p>
      </div>
    );
  }

  const go = (delta: number) => setIndex((i) => (i + delta + ordered.length) % ordered.length);

  return (
    <div className="space-y-2">
      <div className="group relative overflow-hidden rounded-lg border bg-card">
        <PropertyImage key={current.id} src={current.url} alt={`${title} — photo ${index + 1}`} className="aspect-[16/9] w-full" iconClassName="size-8" />
        {ordered.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" aria-label="Previous photo">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" aria-label="Next photo">
              <ChevronRight className="size-4" />
            </button>
            <span className="tabular absolute right-3 bottom-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              {index + 1} / {ordered.length}
            </span>
          </>
        )}
      </div>
      {ordered.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {ordered.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              className={cn("shrink-0 overflow-hidden rounded-md border-2 transition-opacity", i === index ? "border-gold" : "border-transparent opacity-70 hover:opacity-100")}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
            >
              <PropertyImage src={img.url} alt="" className="h-14 w-20" iconClassName="size-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
