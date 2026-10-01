'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Building2, CalendarClock, CheckSquare, Handshake, Mail, MessageSquare, Phone } from 'lucide-react';
import type { PortalOverview } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Card, dateTime, Empty, money, PageTitle, Section } from '@/components/portal/ui';

export default function PortalOverviewPage() {
  const locale = useLocale();
  const state = usePortal<PortalOverview>('/portal/overview');
  return (
    <Section state={state}>
      {({ client, counts, upcomingViewings }) => (
        <>
          <PageTitle title={`Welcome, ${client.fullName.split(' ')[0]}`} description="Your shortlist, viewings and requests with ELITE Real Estate." />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Shortlisted properties', value: counts.shortlisted, icon: Building2, href: 'properties' },
              { label: 'Upcoming viewings', value: counts.upcomingViewings, icon: CalendarClock, href: 'reports' },
              { label: 'Open enquiries', value: counts.openEnquiries, icon: MessageSquare, href: 'leads' },
              { label: 'Deals in progress', value: counts.activeDeals, icon: Handshake, href: 'reports' },
            ].map((s) => (
              <Link key={s.label} href={`/${locale}/dashboard/${s.href}`}>
                <Card className="p-5 hover:border-[#b98f42]/40 transition-colors">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mt-3">{s.value}</p>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 mt-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="p-6">
              <h2 className="font-bold text-gray-900 mb-4">Upcoming viewings</h2>
              {upcomingViewings.length === 0 ? (
                <Empty icon={CalendarClock} title="No viewings scheduled" description="Ask your agent to arrange a viewing for any property on your shortlist." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {upcomingViewings.map((v) => (
                    <li key={v.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-900">{v.property.title}</p>
                        <p className="text-sm text-gray-500">
                          {v.property.area} · {money(v.property.price, v.property.currency)}
                          {v.property.purpose === 'RENT' ? ' / month' : ''}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-bold text-[#b98f42]">{dateTime(v.startsAt)}</p>
                        {v.agent && <p className="text-gray-500">with {v.agent.name}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-6">
              <h2 className="font-bold text-gray-900 mb-4">Your agent</h2>
              {client.agent ? (
                <div className="space-y-2 text-sm">
                  <p className="font-bold text-gray-900 text-base">{client.agent.name}</p>
                  {client.agent.phone && (
                    <a href={`tel:${client.agent.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-gray-600 hover:text-[#b98f42]">
                      <Phone className="w-4 h-4" /> {client.agent.phone}
                    </a>
                  )}
                  <a href={`mailto:${client.agent.email}`} className="flex items-center gap-2 text-gray-600 hover:text-[#b98f42]">
                    <Mail className="w-4 h-4" /> {client.agent.email}
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-500">An agent will be assigned to you shortly.</p>
              )}
              {counts.openTasks > 0 && (
                <Link href={`/${locale}/dashboard/tasks`} className="mt-5 flex items-center gap-2 text-sm font-bold text-[#b98f42] hover:underline">
                  <CheckSquare className="w-4 h-4" /> {counts.openTasks} open item{counts.openTasks === 1 ? '' : 's'} for you
                </Link>
              )}
            </Card>
          </div>
        </>
      )}
    </Section>
  );
}
