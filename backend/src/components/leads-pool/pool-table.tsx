"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Contact, EyeOff, Hand, MoreHorizontal, Pencil, Trash2, UserCheck, UserPlus } from "lucide-react";
import type { PoolListItem } from "@/services/leads-pool";
import type { AgentOption, Viewer } from "@/types/options";
import { assignPoolLeadAction, cancelPoolRequestAction, deletePoolLeadAction, requestPoolLeadAction } from "@/actions/leads-pool";
import { useAction } from "@/hooks/use-action";
import { CUSTOMER_TYPE_META, POOL_LEAD_STATUS_META, PURPOSE_META, ROLE_META } from "@/lib/constants";
import { formatDate, formatMoneyCompact } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table/data-table";
import { ConfirmAction } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { AgentCell } from "@/components/shared/user-avatar";
import { PoolLeadSheet } from "./pool-form";

function budget(p: PoolListItem) {
  if (p.budgetMin == null && p.budgetMax == null) return null;
  if (p.budgetMin != null && p.budgetMax != null) return `${formatMoneyCompact(p.budgetMin)} – ${formatMoneyCompact(p.budgetMax).replace("QAR ", "")}`;
  return p.budgetMax != null ? `≤ ${formatMoneyCompact(p.budgetMax)}` : `≥ ${formatMoneyCompact(p.budgetMin)}`;
}

/** Agents: "Get this lead" (a request to the management), or the state of their request. */
function AgentAction({ row }: { row: PoolListItem }) {
  const router = useRouter();
  const cancel = useAction(cancelPoolRequestAction, { onSuccess: () => router.refresh() });
  if (row.myRequest?.status === "PENDING") {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs font-medium whitespace-nowrap text-amber-700">Requested</span>
        <Button variant="ghost" size="sm" loading={cancel.pending} onClick={() => void cancel.run({ requestId: row.myRequest!.id })}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <ConfirmAction
      title="Get this lead?"
      description="Your request goes to the management. Once they approve it, the lead appears on your Leads page with the full number."
      confirmLabel="Send request"
      destructive={false}
      action={requestPoolLeadAction}
      input={{ id: row.id }}
      onDone={() => router.refresh()}
    >
      <Button size="sm" variant={row.myRequest?.status === "REJECTED" ? "outline" : "default"}>
        <Hand /> {row.myRequest?.status === "REJECTED" ? "Ask again" : "Get this lead"}
      </Button>
    </ConfirmAction>
  );
}

function GiveDialog({ row, agents, open, onOpenChange }: { row: PoolListItem; agents: AgentOption[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [agentId, setAgentId] = useState("");
  const give = useAction(assignPoolLeadAction, {
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !give.pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give this lead to an agent</DialogTitle>
          <DialogDescription>
            {row.fullName ?? row.phone} becomes a new lead on their Leads page{row.pendingRequests ? "; waiting requests from other agents are declined" : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Agent</Label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-full" aria-label="Agent">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.role === "AGENT" ? a.name : `${a.name} (${ROLE_META[a.role].label})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={give.pending}>
            Cancel
          </Button>
          <Button loading={give.pending} disabled={!agentId} onClick={() => void give.run({ id: row.id, agentId })}>
            Give lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManagerActions({ row, agents }: { row: PoolListItem; agents: AgentOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "give" | "take" | "edit" | "delete">(null);
  const set = (key: typeof open) => (o: boolean) => setOpen(o ? key : null);
  return (
    <div className="flex items-center justify-end gap-2">
      {row.pendingRequests > 0 && (
        <a href="#requests" className="text-xs font-medium whitespace-nowrap text-amber-700 hover:underline">
          {row.pendingRequests} request{row.pendingRequests === 1 ? "" : "s"}
        </a>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${row.fullName ?? row.phone}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {row.status === "AVAILABLE" && (
            <>
              <DropdownMenuItem onSelect={() => setOpen("give")}>
                <UserPlus /> Give to an agent…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpen("take")}>
                <UserCheck /> Take it myself
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpen("edit")}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen("delete")}>
            <Trash2 /> Remove from pool
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {open === "give" && <GiveDialog row={row} agents={agents} open onOpenChange={set("give")} />}
      {open === "edit" && <PoolLeadSheet open onOpenChange={set("edit")} record={row} />}
      <ConfirmAction
        open={open === "take"}
        onOpenChange={set("take")}
        title="Take this lead?"
        description="It becomes a new lead assigned to you."
        confirmLabel="Take lead"
        destructive={false}
        action={requestPoolLeadAction}
        input={{ id: row.id }}
        onDone={(r) => (r.leadId ? router.push(`/leads/${r.leadId}`) : router.refresh())}
      />
      <ConfirmAction
        open={open === "delete"}
        onOpenChange={set("delete")}
        title="Remove from the pool?"
        description={row.status === "TAKEN" ? "Only the pool entry is removed — the lead it became stays on the Leads page." : "The number is deleted from the pool. Waiting requests for it are cancelled."}
        confirmLabel="Remove"
        action={deletePoolLeadAction}
        input={{ id: row.id }}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

export function PoolTable({ rows, viewer, agents, filtered, taken }: { rows: PoolListItem[]; viewer: Viewer; agents: AgentOption[]; filtered: boolean; taken: boolean }) {
  const columns: Column<PoolListItem>[] = [
    {
      id: "contact",
      header: "Contact",
      sortKey: "fullName",
      cell: (p) => (
        <div className="min-w-[160px]">
          <p className="font-medium">{p.fullName ?? <span className="text-muted-foreground">No name</span>}</p>
          <p className="flex items-center gap-1 font-mono text-xs text-muted-foreground tabular">
            {p.masked && <EyeOff className="size-3" aria-label="Hidden until approved" />}
            {p.phone}
          </p>
          {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
        </div>
      ),
    },
    {
      id: "needs",
      header: "Looking for",
      cell: (p) => {
        const parts = [p.interestedArea, p.bedrooms != null ? (p.bedrooms === 0 ? "Studio" : `${p.bedrooms} bed`) : null, budget(p)].filter(Boolean);
        if (!p.leadType && !p.purpose && !parts.length) return <span className="text-xs text-muted-foreground">Not specified</span>;
        return (
          <div className="min-w-[150px] text-[13px]">
            <span className="flex flex-wrap items-center gap-1.5">
              {p.leadType && <span className="font-medium">{CUSTOMER_TYPE_META[p.leadType].label}</span>}
              {p.purpose && <EnumBadge meta={PURPOSE_META} value={p.purpose} />}
            </span>
            {parts.length > 0 && <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>}
          </div>
        );
      },
    },
    { id: "notes", header: "Notes", cell: (p) => <p className="line-clamp-2 max-w-[280px] text-xs text-muted-foreground">{p.notes ?? "—"}</p> },
    ...(viewer.isManager && taken
      ? [
          { id: "status", header: "Status", cell: (p: PoolListItem) => <EnumBadge meta={POOL_LEAD_STATUS_META} value={p.status} dot /> },
          {
            id: "takenBy",
            header: "Taken by",
            cell: (p: PoolListItem) =>
              p.takenBy ? (
                <div className="space-y-0.5">
                  <AgentCell agent={p.takenBy} />
                  {p.leadId && (
                    <Link href={`/leads/${p.leadId}`} className="text-xs text-muted-foreground hover:underline">
                      Open lead · {formatDate(p.takenAt)}
                    </Link>
                  )}
                </div>
              ) : (
                "—"
              ),
          },
        ]
      : []),
    ...(viewer.isManager
      ? [{ id: "addedBy", header: "Added by", defaultHidden: true, cell: (p: PoolListItem) => <span className="text-[13px]">{p.createdBy?.name ?? "—"}</span> }]
      : []),
    { id: "created", header: "Added", sortKey: "createdAt", className: "text-xs text-muted-foreground whitespace-nowrap", cell: (p) => formatDate(p.createdAt) },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      className: "text-right",
      cell: (p) => (viewer.isManager ? <ManagerActions row={p} agents={agents} /> : <AgentAction row={p} />),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(p) => p.id}
      storageKey="leads-pool"
      empty={
        <EmptyState
          icon={Contact}
          title={filtered ? "Nothing matches these filters" : taken ? "No taken leads yet" : "The pool is empty"}
          description={filtered ? "Clear a filter or try another search." : viewer.isManager ? "Add numbers one by one, or paste a list." : "New numbers appear here when the management adds them."}
        />
      }
    />
  );
}
