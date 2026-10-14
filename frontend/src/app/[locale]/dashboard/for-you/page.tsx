'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { SlidersHorizontal, Sparkles } from 'lucide-react';
import type { Recommendation } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Card, Empty, PageTitle, Section } from '@/components/portal/ui';
import PropertyCard from '@/components/properties/PropertyCard';

/** "Homes for you": picked from the live CRM inventory using the client's preferences and saved homes. */
export default function ForYouPage() {
  const locale = useLocale();
  const state = usePortal<{ basedOn: 'preferences' | 'featured'; items: Recommendation[] }>('/portal/recommendations');
  return (
    <>
      <PageTitle
        title="Homes for you"
        description="Matched to your preferences and the homes you saved — updated as new listings go live."
        actions={
          <Link href={`/${locale}/dashboard/preferences`} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:border-[#b98f42]">
            <SlidersHorizontal className="h-4 w-4" /> Edit preferences
          </Link>
        }
      />
      <Section state={state}>
        {({ basedOn, items }) => (
          <>
            {basedOn === 'featured' && (
              <p className="mb-4 rounded-xl bg-[#b98f42]/10 px-4 py-3 text-sm text-[#8a6a2f]">
                Tell us what you&apos;re looking for in <Link href={`/${locale}/dashboard/preferences`} className="font-bold underline">Preferences</Link> to get personal matches. Meanwhile, here are our featured homes.
              </p>
            )}
            {items.length === 0 ? (
              <Card>
                <Empty icon={Sparkles} title="No matches right now" description="Try widening your budget or adding more areas — we'll show new listings here as soon as they go live." />
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
                {items.map((r) => (
                  <PropertyCard
                    key={r.property._id}
                    property={r.property}
                    footer={
                      <div className="flex flex-wrap items-center gap-2">
                        {r.matchPercent != null && <span className="rounded-full bg-[#b98f42] px-2 py-0.5 font-bold text-white">{r.matchPercent}% match</span>}
                        {r.reasons.map((reason) => (
                          <span key={reason} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            {reason}
                          </span>
                        ))}
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Section>
    </>
  );
}
