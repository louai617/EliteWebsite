'use client';

import { Activity } from 'lucide-react';
import type { PortalActivityItem } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Card, dateTime, Empty, PageTitle, Section } from '@/components/portal/ui';

export default function PortalActivityPage() {
  const state = usePortal<PortalActivityItem[]>('/portal/activity');
  return (
    <>
      <PageTitle title="Activity" description="Everything that happened on your account, newest first." />
      <Card className="p-6">
        <Section state={state} empty={(rows) => (rows.length === 0 ? <Empty icon={Activity} title="No activity yet" /> : null)}>
          {(rows) => (
            <ol className="relative border-l border-gray-200 ml-2 space-y-5">
              {rows.map((a) => (
                <li key={a.id} className="ml-5">
                  <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-[#b98f42] border-2 border-white" />
                  <p className="text-sm text-gray-900">{a.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{dateTime(a.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </Card>
    </>
  );
}
