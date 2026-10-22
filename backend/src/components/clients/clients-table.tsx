"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import type { ClientListItem } from "@/services/clients";
import { CUSTOMER_TYPE_META } from "@/lib/constants";
import { formatDate, formatMoneyCompact } from "@/lib/format";
import { DataTable, type Column } from "@/components/shared/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { AgentCell } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";

export function ClientsTable({ rows, filtered }: { rows: ClientListItem[]; filtered: boolean }) {
  const columns: Column<ClientListItem>[] = [
    {
      id: "name",
      header: "Client",
      sortKey: "fullName",
      cell: (c) => (
        <div className="min-w-[170px]">
          <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
            {c.fullName}
          </Link>
          <p className="text-xs text-muted-foreground">{c.phone}</p>
        </div>
      ),
    },
    { id: "type", header: "Type", cell: (c) => <Badge tone="neutral">{CUSTOMER_TYPE_META[c.clientType].label}</Badge> },
    { id: "email", header: "E-mail", cell: (c) => <span className="text-[13px]">{c.email ?? "—"}</span> },
    {
      id: "budget",
      header: "Budget",
      sortKey: "budgetMax",
      className: "tabular text-[13px] whitespace-nowrap",
      cell: (c) => (c.budgetMax != null ? `${c.budgetMin != null ? formatMoneyCompact(c.budgetMin) + " – " : "≤ "}${formatMoneyCompact(c.budgetMax)}` : "—"),
    },
    { id: "nationality", header: "Nationality", defaultHidden: true, cell: (c) => c.nationality ?? "—" },
    { id: "activity", header: "Viewings / deals", className: "tabular text-[13px]", cell: (c) => `${c._count.viewings} / ${c._count.deals}` },
    { id: "agent", header: "Agent", cell: (c) => <AgentCell agent={c.agent} /> },
    { id: "created", header: "Added", sortKey: "createdAt", className: "text-xs text-muted-foreground whitespace-nowrap", cell: (c) => formatDate(c.createdAt) },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(c) => c.id}
      rowHref={(c) => `/clients/${c.id}`}
      storageKey="clients"
      empty={<EmptyState icon={UserRound} title={filtered ? "No clients match" : "No clients yet"} description="Convert qualified leads into clients from the lead page." />}
    />
  );
}
