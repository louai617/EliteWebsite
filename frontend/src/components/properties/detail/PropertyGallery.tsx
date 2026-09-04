'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { X, ChevronLeft, ChevronRight, Expand, Camera } from 'lucide-react';

interface PropertyGalleryProps {
  images: string[];
  title: string;
}

/**
 * Editorial mosaic that opens into a full-screen lightbox.
 *
 * The lightbox is keyboard-first: arrows page through, Escape closes, and focus
 * is parked on the dialog so screen readers announce it. Arrow direction flips
 * under RTL so "next" always means "forward" visually.
 */
export default function PropertyGallery({ images, title }: PropertyGalleryProps) {
  const t = useTranslations('property');
  const locale = useLocale();
  const isRtl = locale === 'ar';

  const [lightboxAt, setLightboxAt] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const isOpen = lightboxAt !== null;
  const total = images.length;

  const open = (index: number) => {
    lastFocused.current = document.activeElement as HTMLElement;
    setLightboxAt(index);
  };

  const close = useCallback(() => {
    setLightboxAt(null);
    lastFocused.current?.focus();
  }, []);

  const step = useCallback(
    (delta: number) => {
      setLightboxAt((current) => {
        if (current === null) return current;
        return (current + delta + total) % total;
      });
    },
    [total]
  );

  // Keyboard control + scroll lock while the lightbox is open.
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      // In RTL the visual "forward" arrow is the left one.
      if (event.key === 'ArrowRight') step(isRtl ? -1 : 1);
      if (event.key === 'ArrowLeft') step(isRtl ? 1 : -1);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close, step, isRtl]);

  const mosaic = images.slice(0, 5);

  return (
    <>
      {/* Mosaic: one hero frame plus a 2x2 grid, collapsing to a single frame on mobile. */}
      <div className="relative grid h-[300px] grid-cols-1 gap-2 overflow-hidden rounded-2xl sm:h-[420px] md:h-[540px] md:grid-cols-4 md:grid-rows-2">
        <button
          type="button"
          onClick={() => open(0)}
          className="group relative col-span-1 row-span-1 overflow-hidden md:col-span-2 md:row-span-2"
          aria-label={t('photo_counter', { current: 1, total })}
        >
          <Image
            src={mosaic[0]}
            alt={title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </button>

        {mosaic.slice(1, 5).map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => open(index + 1)}
            className="group relative hidden overflow-hidden md:block"
            aria-label={t('photo_counter', { current: index + 2, total })}
          >
            <Image
              src={src}
              alt={`${title} — ${index + 2}`}
              fill
              sizes="25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
          </button>
        ))}

        {/* Photo count / open-all affordance */}
        <button
          type="button"
          onClick={() => open(0)}
          className="absolute bottom-4 end-4 z-10 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-secondary shadow-lg backdrop-blur transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          {t('photos', { count: total })}
          <Expand className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </button>
      </div>

      {/* Lightbox */}
      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 outline-none backdrop-blur-sm"
        >
          <div className="flex items-center justify-between px-4 py-4 text-white sm:px-6">
            <span className="text-sm font-medium tabular-nums text-white/80">
              {t('photo_counter', { current: lightboxAt + 1, total })}
            </span>
            <button
              type="button"
              onClick={close}
              className="rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={t('close_gallery')}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="relative flex-1">
            <Image
              key={images[lightboxAt]}
              src={images[lightboxAt]}
              alt={`${title} — ${lightboxAt + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
            />

            <button
              type="button"
              onClick={() => step(isRtl ? 1 : -1)}
              className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:start-6"
              aria-label={t('previous_photo')}
            >
              <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => step(isRtl ? -1 : 1)}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:end-6"
              aria-label={t('next_photo')}
            >
              <ChevronRight className="h-6 w-6 rtl:rotate-180" />
            </button>
          </div>

          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto px-4 py-4 sm:px-6">
            {images.map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() => setLightboxAt(index)}
                className={`relative h-16 w-24 flex-none overflow-hidden rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  index === lightboxAt
                    ? 'ring-2 ring-primary'
                    : 'opacity-50 hover:opacity-100'
                }`}
                aria-label={t('photo_counter', { current: index + 1, total })}
                aria-current={index === lightboxAt}
              >
                <Image src={src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
