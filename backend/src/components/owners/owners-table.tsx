"use client";

import Link from "next/link";
import { KeyRound, Mail, Phone } from "lucide-react";
import type { OwnerListItem } from "@/services/owners";
import { formatDate } from "@/lib/format";
import { DataTable, type Column } from "@/components/shared/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";

export function OwnersTable({ rows, filtered }: { rows: OwnerListItem[]; filtered: boolean }) {
  const columns: Column<OwnerListItem>[] = [
    {
      id: "name",
      header: "Owner",
      sortKey: "fullName",
      cell: (o) => (
        <div className="min-w-[180px]">
          <Link href={`/owners/${o.id}`} className="font-medium hover:underline">
            {o.fullName}
          </Link>
          <p className="text-xs text-muted-foreground">{o.nationality ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (o) => (
        <div className="space-y-0.5 text-[13px]">
          <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:underline">
            <Phone className="size-3 text-muted-foreground" /> {o.phone}
          </a>
          {o.email && (
            <a href={`mailto:${o.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:underline">
              <Mail className="size-3" /> {o.email}
            </a>
          )}
        </div>
      ),
    },
    { id: "properties", header: "Properties", className: "tabular text-center", headClassName: "text-center", cell: (o) => o._count.properties },
    {
      id: "active",
      header: "Active listings",
      className: "tabular text-center",
      headClassName: "text-center",
      cell: (o) => (o.activeListings ? <span className="font-medium text-emerald-700">{o.activeListings}</span> : <span className="text-muted-foreground">0</span>),
    },
    { id: "deals", header: "Deals", className: "tabular text-center", headClassName: "text-center", cell: (o) => o._count.deals },
    { id: "created", header: "Added", sortKey: "createdAt", className: "text-xs text-muted-foreground whitespace-nowrap", cell: (o) => formatDate(o.createdAt) },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(o) => o.id}
      rowHref={(o) => `/owners/${o.id}`}
      storageKey="owners"
      empty={<EmptyState icon={KeyRound} title={filtered ? "No owners match" : "No owners yet"} description="Owners are landlords and sellers whose properties you list." />}
    />
  );
}
