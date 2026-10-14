'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowRight, CalendarClock, Check, Handshake, Heart, Mail, MessageSquare, Phone, Sparkles, TrendingDown } from 'lucide-react';
import type { PortalOverview, Recommendation } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Card, cn, Empty, money, Section } from '@/components/portal/ui';
import PropertyCard from '@/components/properties/PropertyCard';

const TZ = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'Asia/Qatar';

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: TZ }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function untilLabel(iso: string) {
  const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  if (hours < 24) return hours <= 1 ? 'Starting soon' : `In ${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

/** Joined → Enquiry → Viewing booked → Viewed → Offer → Contract → Keys, from real CRM records. */
function Journey({ steps, current, complete }: { steps: string[]; current: number; complete?: boolean }) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-bold text-gray-900">Your journey</h2>
        <span className="text-xs font-medium text-gray-500">
          {complete ? 'Keys in hand — congratulations!' : `Step ${current + 1} of ${steps.length}`}
        </span>
      </div>
      <ol className="flex items-start">
        {steps.map((step, i) => {
          const done = i < current || (complete && i === current);
          const active = i === current && !complete;
          return (
            <li key={step} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && <span className={cn('absolute end-1/2 top-3.5 h-0.5 w-full', i <= current ? 'bg-[#b98f42]' : 'bg-gray-200')} aria-hidden="true" />}
              <span className={cn('relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold', done ? 'border-[#b98f42] bg-[#b98f42] text-white' : active ? 'border-[#b98f42] bg-white text-[#b98f42] ring-4 ring-[#b98f42]/15' : 'border-gray-200 bg-white text-gray-400')}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn('mt-2 hidden text-[11px] font-medium sm:block', active || (complete && i === current) ? 'text-gray-900' : 'text-gray-400')}>{step}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-gray-500 sm:hidden">
        Now: <span className="font-bold text-gray-900">{steps[current]}</span>
      </p>
    </Card>
  );
}

export default function PortalOverviewPage() {
  const locale = useLocale();
  const state = usePortal<PortalOverview>('/portal/overview');
  const picks = usePortal<{ basedOn: string; items: Recommendation[] }>('/portal/recommendations');
  const base = `/${locale}/dashboard`;

  return (
    <Section state={state}>
      {({ client, counts, upcomingViewings, journey }) => {
        const next = upcomingViewings[0];
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                {greeting()}, {client.fullName.split(' ')[0]}
              </h1>
              <p className="mt-1 text-sm text-gray-500">Everything about your search with ELITE Real Estate, in one place.</p>
            </div>

            {counts.priceDrops > 0 && (
              <Link href={`${base}/saved`} className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 transition hover:border-emerald-300">
                <TrendingDown className="h-5 w-5 flex-none text-emerald-600" />
                <span>
                  <span className="font-bold">Price drop!</span> {counts.priceDrops} of your saved home{counts.priceDrops === 1 ? ' is' : 's are'} now cheaper.
                </span>
                <ArrowRight className="ms-auto h-4 w-4" />
              </Link>
            )}

            {journey && <Journey steps={journey.steps} current={journey.current} complete={journey.complete} />}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              {next ? (
                <Card className="overflow-hidden">
                  <div className="grid sm:grid-cols-[200px_minmax(0,1fr)]">
                    <div className="relative h-40 bg-gray-100 sm:h-full">
                      {next.property.images[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={next.property.images[0].url} alt={next.property.title} className="absolute inset-0 h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      )}
                    </div>
                    <div className="p-6">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#b98f42]">Next viewing · {untilLabel(next.startsAt)}</p>
                      <h2 className="mt-1 text-lg font-bold text-gray-900">{next.property.title}</h2>
                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        {new Date(next.startsAt).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {next.property.area} · {money(next.property.price, next.property.currency)}
                        {next.property.purpose === 'RENT' ? ' / month' : ''}
                      </p>
                      <p className="mt-2 text-xs font-medium">{next.status === 'CONFIRMED' ? <span className="text-emerald-700">Confirmed by your agent</span> : <span className="text-amber-700">Waiting for your agent to confirm</span>}</p>
                      <Link href={`${base}/bookings`} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#b98f42] hover:underline">
                        Manage bookings <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="flex flex-col justify-center p-6">
                  <Empty icon={CalendarClock} title="No viewing booked yet" description="Find a home you like and book a viewing in a few taps." />
                  <div className="text-center">
                    <Link href={`/${locale}/properties`} className="rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#b98f42]">
                      Browse properties
                    </Link>
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h2 className="mb-4 font-bold text-gray-900">Your agent</h2>
                {client.agent ? (
                  <div className="space-y-2 text-sm">
                    <p className="text-base font-bold text-gray-900">{client.agent.name}</p>
                    {client.agent.phone && (
                      <a href={`tel:${client.agent.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-gray-600 hover:text-[#b98f42]">
                        <Phone className="h-4 w-4" /> {client.agent.phone}
                      </a>
                    )}
                    {client.agent.phone && (
                      <a href={`https://wa.me/${client.agent.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 hover:text-emerald-700">
                        <MessageSquare className="h-4 w-4" /> WhatsApp
                      </a>
                    )}
                    <a href={`mailto:${client.agent.email}`} className="flex items-center gap-2 text-gray-600 hover:text-[#b98f42]">
                      <Mail className="h-4 w-4" /> {client.agent.email}
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">An agent will be assigned to you shortly.</p>
                )}
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Saved homes', value: counts.shortlisted, icon: Heart, href: 'saved' },
                { label: 'Upcoming viewings', value: counts.upcomingViewings, icon: CalendarClock, href: 'bookings' },
                { label: 'Open enquiries', value: counts.openEnquiries, icon: MessageSquare, href: 'leads' },
                { label: 'Deals in progress', value: counts.activeDeals, icon: Handshake, href: 'reports' },
              ].map((s) => (
                <Link key={s.label} href={`${base}/${s.href}`}>
                  <Card className="p-5 transition-colors hover:border-[#b98f42]/40">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
                      <s.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-3xl font-bold text-gray-900">{s.value}</p>
                  </Card>
                </Link>
              ))}
            </div>

            {picks.data && picks.data.items.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-bold text-gray-900">
                    <Sparkles className="h-4 w-4 text-[#b98f42]" /> Homes for you
                  </h2>
                  <Link href={`${base}/for-you`} className="text-sm font-bold text-[#b98f42] hover:underline">
                    See all
                  </Link>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
                  {picks.data.items.slice(0, 3).map((r) => (
                    <PropertyCard
                      key={r.property._id}
                      property={r.property}
                      footer={r.matchPercent != null ? <span className="font-bold text-[#b98f42]">{r.matchPercent}% match · {r.reasons.join(' · ')}</span> : undefined}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        );
      }}
    </Section>
  );
}
