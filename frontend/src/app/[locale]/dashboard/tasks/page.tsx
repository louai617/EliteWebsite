'use client';

import { CheckSquare } from 'lucide-react';
import type { PortalTask } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Badge, Card, date, Empty, label, PageTitle, Section, statusTone } from '@/components/portal/ui';

export default function PortalTasksPage() {
  const state = usePortal<PortalTask[]>('/portal/tasks');
  return (
    <>
      <PageTitle title="Tasks" description="Next steps your agent has shared with you — documents to send, signings, handovers." />
      <Card className="p-2 sm:p-4">
        <Section state={state} empty={(rows) => (rows.length === 0 ? <Empty icon={CheckSquare} title="Nothing to do right now" description="When there's something you need to do, it will show up here." /> : null)}>
          {(rows) => (
            <ul className="divide-y divide-gray-100">
              {rows.map((t) => (
                <li key={t.id} className="p-3 sm:p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={t.status === 'COMPLETED' || t.status === 'CANCELLED' ? 'font-bold text-gray-400 line-through' : 'font-bold text-gray-900'}>{t.title}</p>
                    {t.description && <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{t.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {t.dueDate && `Due ${date(t.dueDate)}`}
                      {t.completedAt && ` · Done ${date(t.completedAt)}`}
                      {t.assignee && ` · ${t.assignee.name}`}
                    </p>
                  </div>
                  <Badge tone={statusTone(t.status)}>{label(t.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Card>
    </>
  );
}
