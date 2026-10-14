"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Listing photo with a graceful fallback. Uses a plain <img> because photos can come
 * from any URL an agent pastes (portals, CDNs) as well as local uploads.
 */
export function PropertyImage({ src, alt, className, iconClassName }: { src: string | null | undefined; alt: string; className?: string; iconClassName?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 text-stone-400", className)} role="img" aria-label={alt}>
        <Building2 className={cn("size-5", iconClassName)} />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("object-cover", className)} loading="lazy" onError={() => setFailed(true)} />;
}
