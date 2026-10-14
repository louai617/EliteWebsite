"use client";

import Link from "next/link";
import { UsersRound } from "lucide-react";
import type { LeadListItem } from "@/services/leads";
import { LEAD_SOURCE_META, LEAD_STATUS_META, PRIORITY_META, PURPOSE_META } from "@/lib/constants";
import { formatDate, formatMoneyCompact } from "@/lib/format";
import { DataTable, type Column } from "@/components/shared/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { AgentCell } from "@/components/shared/user-avatar";

function budget(l: LeadListItem) {
  if (l.budgetMin == null && l.budgetMax == null) return "—";
  if (l.budgetMin != null && l.budgetMax != null) return `${formatMoneyCompact(l.budgetMin)} – ${formatMoneyCompact(l.budgetMax).replace("QAR ", "")}`;
  return l.budgetMax != null ? `≤ ${formatMoneyCompact(l.budgetMax)}` : `≥ ${formatMoneyCompact(l.budgetMin)}`;
}

export function LeadsTable({ rows, filtered }: { rows: LeadListItem[]; filtered: boolean }) {
  const columns: Column<LeadListItem>[] = [
    {
      id: "name",
      header: "Lead",
      sortKey: "fullName",
      cell: (l) => (
        <div className="min-w-[170px]">
          <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
            {l.fullName}
          </Link>
          <p className="text-xs text-muted-foreground">{l.phone}</p>
        </div>
      ),
    },
    { id: "status", header: "Status", cell: (l) => <EnumBadge meta={LEAD_STATUS_META} value={l.status} dot /> },
    { id: "priority", header: "Priority", cell: (l) => <EnumBadge meta={PRIORITY_META} value={l.priority} /> },
    { id: "source", header: "Source", cell: (l) => <span className="text-[13px] whitespace-nowrap">{LEAD_SOURCE_META[l.source].label}</span> },
    {
      id: "looking",
      header: "Looking for",
      cell: (l) => (
        <div className="text-[13px]">
          <span className="flex items-center gap-1.5">
            {l.purpose && <EnumBadge meta={PURPOSE_META} value={l.purpose} />}
            <span className="truncate">{l.interestedArea ?? "Any area"}</span>
          </span>
          {l.bedrooms != null && <p className="text-xs text-muted-foreground">{l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bedrooms`}</p>}
        </div>
      ),
    },
    { id: "budget", header: "Budget", sortKey: "budgetMax", className: "tabular text-[13px] whitespace-nowrap", cell: budget },
    { id: "agent", header: "Agent", cell: (l) => <AgentCell agent={l.agent} /> },
    { id: "email", header: "E-mail", defaultHidden: true, cell: (l) => <span className="text-[13px]">{l.email ?? "—"}</span> },
    { id: "stage", header: "In stage since", sortKey: "statusChangedAt", defaultHidden: true, className: "text-xs text-muted-foreground whitespace-nowrap", cell: (l) => formatDate(l.statusChangedAt) },
    { id: "created", header: "Created", sortKey: "createdAt", className: "text-xs text-muted-foreground whitespace-nowrap", cell: (l) => formatDate(l.createdAt) },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(l) => l.id}
      rowHref={(l) => `/leads/${l.id}`}
      storageKey="leads"
      empty={<EmptyState icon={UsersRound} title={filtered ? "No leads match these filters" : "No leads yet"} description={filtered ? "Clear a filter or widen the date range." : "New enquiries from every channel land here."} />}
    />
  );
}
