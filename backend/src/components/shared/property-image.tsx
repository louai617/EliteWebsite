"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Listing photo with a graceful fallback. Uses a plain <img> because photos can come
 * from any URL an agent pastes (portals, CDNs) as well as local uploads. Optimized uploads
 * pass their tiny blurred preview (`blur`), shown until the photo has loaded.
 */
export function PropertyImage({
  src,
  alt,
  className,
  iconClassName,
  blur,
  eager = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconClassName?: string;
  blur?: string | null;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 text-stone-400", className)} role="img" aria-label={alt}>
        <Building2 className={cn("size-5", iconClassName)} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn("object-cover", blur && "transition-opacity duration-300", blur && !loaded && "opacity-90", className)}
      style={blur && !loaded ? { backgroundImage: `url(${blur})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      // A cached photo can finish before React attaches onLoad: check once it's mounted.
      ref={(el) => {
        if (el?.complete && el.naturalWidth && !loaded) setLoaded(true);
      }}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}
