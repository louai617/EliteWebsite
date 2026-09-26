"use client";

import { Users } from "lucide-react";
import { can } from "@/lib/permissions";
import { ROLE_META } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { RelativeTime } from "@/components/shared/relative-time";
import type { Viewer } from "@/types/options";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserSheetButton, type UserRecord } from "./user-form";

export interface UserRow extends UserRecord {
  lastLoginAt: Date | null;
  createdAt: Date;
  _count: { leads: number; properties: number; deals: number; assignedTasks: number };
}

export function UsersTable({ rows, viewer }: { rows: UserRow[]; viewer: Viewer }) {
  const columns: Column<UserRow>[] = [
    {
      id: "name",
      header: "Name",
      sortKey: "name",
      cell: (u) => (
        <div className="flex min-w-[200px] items-center gap-2.5">
          <UserAvatar user={u} className="size-8" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium">
              {u.name} {u.id === viewer.id && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    { id: "role", header: "Role", sortKey: "role", cell: (u) => <EnumBadge meta={ROLE_META} value={u.role} /> },
    { id: "status", header: "Status", cell: (u) => (u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>) },
    { id: "phone", header: "Phone", cell: (u) => <span className="text-[13px]">{u.phone ?? "—"}</span> },
    { id: "workload", header: "Leads · Listings · Deals", className: "tabular text-[13px]", cell: (u) => `${u._count.leads} · ${u._count.properties} · ${u._count.deals}` },
    { id: "tasks", header: "Tasks", defaultHidden: true, className: "tabular", cell: (u) => u._count.assignedTasks },
    { id: "login", header: "Last sign-in", sortKey: "lastLoginAt", className: "text-xs text-muted-foreground whitespace-nowrap", cell: (u) => (u.lastLoginAt ? <RelativeTime date={u.lastLoginAt} /> : "Never") },
    { id: "created", header: "Joined", sortKey: "createdAt", defaultHidden: true, className: "text-xs text-muted-foreground", cell: (u) => formatDate(u.createdAt) },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      className: "w-10 text-right",
      cell: (u) => (can.manageRole(viewer, u.role) ? <UserSheetButton user={u} viewer={viewer} /> : null),
    },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(u) => u.id} storageKey="users" empty={<EmptyState icon={Users} title="No team members match" />} />;
}
