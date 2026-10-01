'use client';

import { CalendarClock, Handshake } from 'lucide-react';
import type { PortalReports, PortalViewing } from '@/lib/api-types';
import { usePortal } from '@/components/portal/use-portal';
import { Badge, Card, date, dateTime, Empty, label, money, PageTitle, Section, statusTone } from '@/components/portal/ui';

export default function PortalReportsPage() {
  const reports = usePortal<PortalReports>('/portal/reports');
  const viewings = usePortal<PortalViewing[]>('/portal/viewings');
  return (
    <>
      <PageTitle title="Reports" description="Your viewings and deals with us." />
      <Section state={reports}>
        {({ summary, deals }) => (
          <>
            <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">
              {[
                ['Enquiries', summary.enquiries],
                ['Viewings done', summary.viewingsCompleted],
                ['Viewings booked', summary.viewingsScheduled],
                ['Deals open', summary.dealsOpen],
                ['Deals completed', summary.dealsCompleted],
              ].map(([k, v]) => (
                <Card key={k} className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{k}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{v}</p>
                </Card>
              ))}
            </div>
            <Card className="p-6 mt-6">
              <h2 className="font-bold text-gray-900 mb-4">Deals</h2>
              {deals.length === 0 ? (
                <Empty icon={Handshake} title="No deals yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                        <th className="pb-3 pr-4">Reference</th>
                        <th className="pb-3 pr-4">Property</th>
                        <th className="pb-3 pr-4">Type</th>
                        <th className="pb-3 pr-4 text-right">Amount</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3">Dates</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deals.map((d) => (
                        <tr key={d.id}>
                          <td className="py-3 pr-4 font-mono text-xs">{d.reference}</td>
                          <td className="py-3 pr-4">{d.property.title}</td>
                          <td className="py-3 pr-4">{label(d.type)}</td>
                          <td className="py-3 pr-4 text-right font-bold">{money(d.amount)}</td>
                          <td className="py-3 pr-4"><Badge tone={statusTone(d.status)}>{label(d.status)}</Badge></td>
                          <td className="py-3 text-xs text-gray-500">
                            {d.contractDate ? `Contract ${date(d.contractDate)}` : `Started ${date(d.createdAt)}`}
                            {d.closedAt && ` · Closed ${date(d.closedAt)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </Section>
      <Card className="p-6 mt-6">
        <h2 className="font-bold text-gray-900 mb-4">Viewings</h2>
        <Section state={viewings} empty={(rows) => (rows.length === 0 ? <Empty icon={CalendarClock} title="No viewings yet" /> : null)}>
          {(rows) => (
            <ul className="divide-y divide-gray-100">
              {rows.map((v) => (
                <li key={v.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-bold text-gray-900">{v.property.title}</p>
                    <p className="text-gray-500">{v.property.reference} · {v.property.area}{v.agent ? ` · ${v.agent.name}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600">{dateTime(v.startsAt)}</span>
                    <Badge tone={statusTone(v.status)}>{label(v.status)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Card>
    </>
  );
}
