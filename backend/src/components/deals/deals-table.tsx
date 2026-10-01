"use client";

import Link from "next/link";
import { Handshake } from "lucide-react";
import type { DealListItem } from "@/services/deals";
import { DEAL_STATUS_META, DEAL_TYPE_META } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { DataTable, type Column } from "@/components/shared/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { AgentCell } from "@/components/shared/user-avatar";

export function DealsTable({ rows, filtered }: { rows: DealListItem[]; filtered: boolean }) {
  const columns: Column<DealListItem>[] = [
    {
      id: "deal",
      header: "Deal",
      cell: (d) => (
        <div className="min-w-[120px]">
          <Link href={`/deals/${d.id}`} className="font-mono text-[13px] font-medium hover:underline">
            {d.reference}
          </Link>
          <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</p>
        </div>
      ),
    },
    {
      id: "property",
      header: "Property",
      cell: (d) => (
        <Link href={`/properties/${d.property.id}`} className="block min-w-[180px] hover:underline">
          <span className="line-clamp-1 text-[13px]">{d.property.title}</span>
          <span className="text-xs text-muted-foreground">{d.property.reference} · {d.property.area}</span>
        </Link>
      ),
    },
    { id: "client", header: "Client", cell: (d) => <Link href={`/clients/${d.client.id}`} className="text-[13px] hover:underline">{d.client.fullName}</Link> },
    { id: "type", header: "Type", cell: (d) => <EnumBadge meta={DEAL_TYPE_META} value={d.type} /> },
    { id: "status", header: "Status", cell: (d) => <EnumBadge meta={DEAL_STATUS_META} value={d.status} dot /> },
    { id: "amount", header: "Amount", sortKey: "amount", className: "tabular text-right whitespace-nowrap", headClassName: "text-right", cell: (d) => formatMoney(d.amount) },
    {
      id: "commission",
      header: "Commission",
      sortKey: "commissionAmount",
      className: "tabular text-right whitespace-nowrap",
      headClassName: "text-right",
      cell: (d) => (
        <div>
          <p className="font-medium">{formatMoney(d.commissionAmount)}</p>
          <p className="text-xs text-muted-foreground">{d.commissionPercent}%</p>
        </div>
      ),
    },
    { id: "agentShare", header: "Agent share", defaultHidden: true, className: "tabular text-right", headClassName: "text-right", cell: (d) => formatMoney(d.agentCommission) },
    { id: "companyShare", header: "Company share", defaultHidden: true, className: "tabular text-right", headClassName: "text-right", cell: (d) => formatMoney(d.companyCommission) },
    { id: "agent", header: "Agent", cell: (d) => <AgentCell agent={d.agent} /> },
    { id: "closing", header: "Closing", sortKey: "closingDate", className: "text-xs text-muted-foreground whitespace-nowrap", cell: (d) => formatDate(d.closedAt ?? d.closingDate) },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(d) => d.id}
      rowHref={(d) => `/deals/${d.id}`}
      storageKey="deals"
      empty={<EmptyState icon={Handshake} title={filtered ? "No deals match" : "No deals yet"} description="Create a deal from a property, lead or client page." />}
    />
  );
}
