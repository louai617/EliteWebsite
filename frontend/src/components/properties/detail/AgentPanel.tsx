'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Phone, MessageSquare, Mail, Clock, BadgeCheck, Share2, Check, UserRound } from 'lucide-react';
import type { ListingAgent } from '@/lib/listing-types';
import SaveButton from '@/components/listings/SaveButton';
import BookViewing from '@/components/listings/BookViewing';

interface AgentPanelProps {
  agent: ListingAgent;
  /** Listing reference (ELT-…), used for saving and booking. */
  propertyId: string;
  /** Prefilled into the WhatsApp deep link. */
  shareTitle: string;
  /** Agency phone when the listing has no assigned agent. */
  fallbackPhone?: string;
}

export default function AgentPanel({ agent, propertyId, shareTitle, fallbackPhone }: AgentPanelProps) {
  const t = useTranslations('property');
  const locale = useLocale();
  const isRtl = locale === 'ar';

  const [copied, setCopied] = useState(false);

  const name = agent.name;
  const title = agent.title;
  const agency = isRtl ? agent.agency_name_ar : agent.agency_name_en;
  const phone = agent.phone ?? fallbackPhone ?? null;
  const whatsapp = agent.whatsapp ?? (phone ? phone.replace(/[^0-9]/g, '') : null);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch {
        // User dismissed the sheet — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; nothing useful left to try.
    }
  };

  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(shareTitle)}` : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {t('agent_title')}
      </p>

      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-full ring-2 ring-primary/30">
          {agent.photo ? (
            <Image src={agent.photo} alt={name} fill sizes="64px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
              <UserRound className="h-7 w-7" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-bold text-secondary">{name}</h3>
            {agent.is_superagent && (
              <BadgeCheck className="h-4 w-4 flex-none text-primary" aria-label={t('superagent')} />
            )}
          </div>
          <p className="truncate text-sm text-gray-500">{title}</p>
          <p className="truncate text-xs text-gray-400">{agency}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
        <p className="flex items-center gap-2 text-gray-600">
          <Clock className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
          {agent.response_minutes != null ? t('responds_in', { minutes: agent.response_minutes }) : t('response_unknown')}
        </p>
      </div>

      <div className="mt-5 grid gap-2.5">
        <BookViewing reference={propertyId} agentName={name} />
        {phone && (
        <a
          href={`tel:${phone.replace(/\s+/g, '')}`}
          className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-3.5 font-bold text-white transition hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          {t('call')}
        </a>
        )}
        {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-primary py-3.5 font-bold text-primary transition hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          {t('whatsapp')}
        </a>
        )}
        {agent.email && (
        <a
          href={`mailto:${agent.email}?subject=${encodeURIComponent(shareTitle)}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3.5 font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          {t('email_agent')}
        </a>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <SaveButton reference={propertyId} variant="button" />
        <button
          type="button"
          onClick={share}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
          ) : (
            <Share2 className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? t('link_copied') : t('share')}
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        {t('agent_listings', { count: agent.listings_count })}
      </p>
    </div>
  );
}
