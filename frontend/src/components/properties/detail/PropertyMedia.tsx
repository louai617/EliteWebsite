'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Box, Download, ExternalLink, FileText, Film, LayoutPanelTop } from 'lucide-react';
import type { ListingMedia, ListingMediaItem } from '@/lib/listing-types';

type Tab = 'video' | 'tour' | 'floor_plans';

/** An embeddable player (YouTube, Vimeo, Matterport, Kuula), an uploaded video, or a plain link. */
function Player({ item, kind }: { item: ListingMediaItem; kind: 'video' | 'tour' }) {
  const t = useTranslations('media');
  if (item.embed_url) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        <iframe
          src={item.embed_url}
          title={item.title ?? (kind === 'video' ? t('video') : t('tour'))}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; xr-spatial-tracking"
          allowFullScreen
        />
      </div>
    );
  }
  if (item.provider === 'file' && kind === 'video') {
    return (
      <video controls preload="metadata" playsInline className="aspect-video w-full rounded-2xl bg-black">
        <source src={item.url} type={item.mime_type ?? undefined} />
        {t('unsupported')}
      </video>
    );
  }
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 p-5 transition hover:border-primary">
      <span className="flex items-center gap-3 font-semibold text-secondary">
        {kind === 'video' ? <Film className="h-5 w-5 text-primary" /> : <Box className="h-5 w-5 text-primary" />}
        {item.title ?? (kind === 'video' ? t('video') : t('tour'))}
      </span>
      <span className="flex items-center gap-1 text-sm text-gray-500">
        {t('open_link')} <ExternalLink className="h-4 w-4" />
      </span>
    </a>
  );
}

/**
 * Listing media from the agent app: videos, 360° tours, floor plans and a brochure.
 * Deep links: #media-video, #media-tour, #media-floor_plans open the matching tab.
 */
export default function PropertyMedia({ media }: { media: ListingMedia }) {
  const t = useTranslations('media');
  const tabs = ([
    ['video', media.videos.length, Film, t('video')],
    ['tour', media.tours.length, Box, t('tour')],
    ['floor_plans', media.floor_plans.length, LayoutPanelTop, t('floor_plans')],
  ] as const).filter(([, count]) => count > 0);
  const [tab, setTab] = useState<Tab>(tabs[0]?.[0] ?? 'video');

  useEffect(() => {
    const fromHash = () => {
      const m = window.location.hash.match(/^#media-(video|tour|floor_plans)$/);
      if (!m) return;
      setTab(m[1] as Tab);
      document.getElementById('media')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  return (
    <div className="space-y-5">
      {tabs.length > 1 && (
        <div role="tablist" aria-label={t('title')} className="inline-flex gap-1 rounded-xl bg-gray-100 p-1">
          {tabs.map(([key, , Icon, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'video' && media.videos.map((v) => (
        <figure key={v.id} className="space-y-2">
          <Player item={v} kind="video" />
          {v.title && <figcaption className="text-sm text-gray-500">{v.title}</figcaption>}
        </figure>
      ))}

      {tab === 'tour' && media.tours.map((v) => (
        <figure key={v.id} className="space-y-2">
          <Player item={v} kind="tour" />
          {v.title && <figcaption className="text-sm text-gray-500">{v.title}</figcaption>}
        </figure>
      ))}

      {tab === 'floor_plans' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {media.floor_plans.map((f) =>
            f.is_pdf ? (
              <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-gray-200 p-5 transition hover:border-primary">
                <FileText className="h-6 w-6 text-primary" />
                <span className="flex-1 font-semibold text-secondary">{f.title ?? t('floor_plan')}</span>
                <span className="text-sm text-gray-500">{t('open_pdf')}</span>
              </a>
            ) : (
              <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-primary">
                {/* eslint-disable-next-line @next/next/no-img-element -- floor plans may come from any https host */}
                <img src={f.url} alt={f.title ?? t('floor_plan')} loading="lazy" className="aspect-[4/3] w-full object-contain p-3" />
                <span className="block border-t border-gray-100 px-4 py-2.5 text-sm font-semibold text-secondary">{f.title ?? t('floor_plan')}</span>
              </a>
            ),
          )}
        </div>
      )}

      {media.brochure && (
        <a href={media.brochure.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border-2 border-primary px-5 py-3 text-sm font-bold text-primary transition hover:bg-primary hover:text-white">
          <Download className="h-4 w-4" /> {media.brochure.title ?? t('brochure')}
        </a>
      )}
    </div>
  );
}
