"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { ViewingItem } from "@/services/viewings";
import { VIEWING_STATUS_META } from "@/lib/constants";
import { formatDayLabel, formatTime } from "@/lib/format";
import type { AgentOption, Viewer } from "@/types/options";
import { DataTable, type Column } from "@/components/shared/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { AgentCell } from "@/components/shared/user-avatar";
import { ViewingActions } from "./viewing-actions";

export function ViewingsTable({ rows, agents, viewer, filtered }: { rows: ViewingItem[]; agents: AgentOption[]; viewer: Viewer; filtered: boolean }) {
  const columns: Column<ViewingItem>[] = [
    {
      id: "date",
      header: "Date",
      sortKey: "startsAt",
      cell: (v) => (
        <div className="whitespace-nowrap">
          <p className="text-[13px] font-medium">{formatDayLabel(v.startsAt)}</p>
          <p className="tabular text-xs text-muted-foreground">
            {formatTime(v.startsAt)}–{formatTime(v.endsAt)}
          </p>
        </div>
      ),
    },
    {
      id: "property",
      header: "Property",
      cell: (v) => (
        <Link href={`/properties/${v.property.id}`} className="block min-w-[200px] hover:underline">
          <span className="line-clamp-1 text-[13px] font-medium">{v.property.title}</span>
          <span className="text-xs text-muted-foreground">
            {v.property.reference} · {v.property.area}
          </span>
        </Link>
      ),
    },
    {
      id: "client",
      header: "Client / lead",
      cell: (v) =>
        v.lead ? (
          <Link href={`/leads/${v.lead.id}`} className="text-[13px] hover:underline">{v.lead.fullName}</Link>
        ) : v.client ? (
          <Link href={`/clients/${v.client.id}`} className="text-[13px] hover:underline">{v.client.fullName}</Link>
        ) : (
          "—"
        ),
    },
    { id: "agent", header: "Agent", cell: (v) => <AgentCell agent={v.agent} /> },
    { id: "status", header: "Status", cell: (v) => <EnumBadge meta={VIEWING_STATUS_META} value={v.status} dot /> },
    { id: "notes", header: "Notes", defaultHidden: true, cell: (v) => <span className="line-clamp-1 max-w-64 text-xs text-muted-foreground">{v.notes ?? "—"}</span> },
    { id: "actions", header: <span className="sr-only">Actions</span>, hideable: false, className: "w-10 text-right", cell: (v) => <ViewingActions viewing={v} agents={agents} viewer={viewer} /> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(v) => v.id}
      storageKey="viewings"
      empty={<EmptyState icon={CalendarClock} title={filtered ? "No viewings match" : "No viewings scheduled"} description="Schedule viewings from a lead, client or property page." />}
    />
  );
}
