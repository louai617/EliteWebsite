'use client';

import { Building2 } from 'lucide-react';
import type { PortalListedProperty } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { PropertyTile } from '@/components/portal/property-tile';
import { Badge, date, Empty, label, PageTitle, Section, statusTone } from '@/components/portal/ui';

export default function PortalPropertiesPage() {
  const state = usePortal<PortalListedProperty[]>('/portal/properties');
  return (
    <>
      <PageTitle title="My properties" description="Listings on your shortlist, that you have viewed, or that you have a deal on." />
      <Section state={state} empty={(rows) => (rows.length === 0 ? <Empty icon={Building2} title="No properties yet" description="Properties your agent shortlists for you will appear here." /> : null)}>
        {(rows) => (
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            {rows.map((p) => (
              <PropertyTile
                key={p.id}
                property={p}
                footer={
                  <div className="flex flex-wrap items-center gap-2">
                    {p.shortlistedAt && <span>Shortlisted {date(p.shortlistedAt)}</span>}
                    {p.lastViewing && <Badge tone={statusTone(p.lastViewing.status)}>Viewing {label(p.lastViewing.status)}</Badge>}
                    {p.deal && <Badge tone={statusTone(p.deal.status)}>Deal {p.deal.reference}: {label(p.deal.status)}</Badge>}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
