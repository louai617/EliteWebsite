"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Contact, EyeOff, Hand, MoreHorizontal, Pencil, Trash2, UserCheck, UserPlus, X } from "lucide-react";
import type { PoolListItem } from "@/services/leads-pool";
import type { AgentOption, Viewer } from "@/types/options";
import { assignPoolLeadsAction, deletePoolLeadsAction, takePoolLeadAction } from "@/actions/leads-pool";
import { useAction } from "@/hooks/use-action";
import { CUSTOMER_TYPE_META, POOL_LEAD_STATUS_META, PURPOSE_META, ROLE_META } from "@/lib/constants";
import { formatDate, formatMoneyCompact } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

/** Agents (and managers for themselves): the entry becomes their lead straight away. */
function TakeButton({ row, open, onOpenChange, children }: { row: PoolListItem; open?: boolean; onOpenChange?: (o: boolean) => void; children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <ConfirmAction
      open={open}
      onOpenChange={onOpenChange}
      title="Get this lead?"
      description="It becomes your lead right away — you'll see the full number on its page. Contact them soon: new leads follow the usual response time."
      confirmLabel="Get lead"
      destructive={false}
      action={takePoolLeadAction}
      input={{ id: row.id }}
      onDone={(r) => router.push(`/leads/${r.leadId}`)}
    >
      {children}
    </ConfirmAction>
  );
}

/** Give one or many entries to an agent. */
function GiveDialog({ ids, agents, open, onOpenChange, onDone }: { ids: string[]; agents: AgentOption[]; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const router = useRouter();
  const [agentId, setAgentId] = useState("");
  const give = useAction(assignPoolLeadsAction, {
    onSuccess: () => {
      onOpenChange(false);
      onDone?.();
      router.refresh();
    },
  });
  const many = ids.length > 1;
  return (
    <Dialog open={open} onOpenChange={(o) => !give.pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{many ? `Give ${ids.length} leads to an agent` : "Give this lead to an agent"}</DialogTitle>
          <DialogDescription>{many ? "They become new leads on the agent's Leads page, with the full numbers." : "It becomes a new lead on the agent's Leads page, with the full number."}</DialogDescription>
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
          <Button loading={give.pending} disabled={!agentId} onClick={() => void give.run({ ids, agentId })}>
            {many ? `Give ${ids.length} leads` : "Give lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({ ids, open, onOpenChange, onDone }: { ids: string[]; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const router = useRouter();
  return (
    <ConfirmAction
      open={open}
      onOpenChange={onOpenChange}
      title={ids.length > 1 ? `Remove ${ids.length} numbers from the pool?` : "Remove from the pool?"}
      description="Only the pool entries are removed — leads already given out stay on the Leads page."
      confirmLabel="Remove"
      action={deletePoolLeadsAction}
      input={{ ids }}
      onDone={() => {
        onDone?.();
        router.refresh();
      }}
    />
  );
}

function ManagerActions({ row, agents }: { row: PoolListItem; agents: AgentOption[] }) {
  const [open, setOpen] = useState<null | "give" | "take" | "edit" | "delete">(null);
  const set = (key: typeof open) => (o: boolean) => setOpen(o ? key : null);
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.fullName ?? row.phone}`}>
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
      {open === "give" && <GiveDialog ids={[row.id]} agents={agents} open onOpenChange={set("give")} />}
      {open === "edit" && <PoolLeadSheet open onOpenChange={set("edit")} record={row} />}
      <TakeButton row={row} open={open === "take"} onOpenChange={set("take")} />
      <RemoveDialog ids={[row.id]} open={open === "delete"} onOpenChange={set("delete")} />
    </div>
  );
}

/** Managers: what to do with the ticked rows, and a quick "tick the first N". */
function SelectionBar({ rows, selected, setSelected, agents }: { rows: PoolListItem[]; selected: string[]; setSelected: (ids: string[]) => void; agents: AgentOption[] }) {
  const [open, setOpen] = useState<null | "give" | "delete">(null);
  const [count, setCount] = useState("20");
  const available = rows.filter((r) => r.status === "AVAILABLE");
  const n = Math.max(1, Math.min(Number(count) || 0, available.length));
  if (!available.length) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs">
      {selected.length ? (
        <>
          <span className="font-medium">{selected.length} selected</span>
          <Button size="sm" onClick={() => setOpen("give")}>
            <UserPlus /> Give to an agent…
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen("delete")}>
            <Trash2 /> Remove
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            <X /> Clear
          </Button>
        </>
      ) : (
        <span className="text-muted-foreground">Tick numbers to give them to an agent, or</span>
      )}
      <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
        Select the first
        <Input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className="h-8 w-14 text-center" aria-label="How many to select" />
        <Button size="sm" variant="outline" onClick={() => setSelected(available.slice(0, n).map((r) => r.id))}>
          Select {n}
        </Button>
      </span>
      {open === "give" && <GiveDialog ids={selected} agents={agents} open onOpenChange={(o) => setOpen(o ? "give" : null)} onDone={() => setSelected([])} />}
      <RemoveDialog ids={selected} open={open === "delete"} onOpenChange={(o) => setOpen(o ? "delete" : null)} onDone={() => setSelected([])} />
    </div>
  );
}

export function PoolTable({ rows, viewer, agents, filtered, taken }: { rows: PoolListItem[]; viewer: Viewer; agents: AgentOption[]; filtered: boolean; taken: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  // Keep only ticks that are still on the page (after a refresh, given rows disappear).
  const visible = selected.filter((id) => rows.some((r) => r.id === id && r.status === "AVAILABLE"));
  const selectable = viewer.isManager && !taken;
  const available = rows.filter((r) => r.status === "AVAILABLE");
  const allTicked = available.length > 0 && available.every((r) => visible.includes(r.id));

  const columns: Column<PoolListItem>[] = [
    ...(selectable
      ? [
          {
            id: "select",
            hideable: false,
            className: "w-8",
            header: (
              <Checkbox
                checked={allTicked ? true : visible.length ? "indeterminate" : false}
                onCheckedChange={(v) => setSelected(v === true ? available.map((r) => r.id) : [])}
                aria-label="Select all on this page"
              />
            ),
            cell: (p: PoolListItem) => (
              <Checkbox
                checked={visible.includes(p.id)}
                onCheckedChange={(v) => setSelected(v === true ? [...visible, p.id] : visible.filter((id) => id !== p.id))}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${p.fullName ?? p.phone}`}
              />
            ),
          },
        ]
      : []),
    {
      id: "contact",
      header: "Contact",
      sortKey: "fullName",
      cell: (p) => (
        <div className="min-w-[160px]">
          <p className="font-medium">{p.fullName ?? <span className="text-muted-foreground">No name</span>}</p>
          <p className="flex items-center gap-1 font-mono text-xs text-muted-foreground tabular">
            {p.masked && <EyeOff className="size-3" aria-label="Hidden until you get the lead" />}
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
    { id: "notes", header: "Notes", cell: (p) => <p className="line-clamp-2 max-w-[300px] text-xs text-muted-foreground">{p.notes ?? "—"}</p> },
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
      ? [
          { id: "batch", header: "From", defaultHidden: true, cell: (p: PoolListItem) => <span className="text-xs text-muted-foreground">{p.batch ?? "Added by hand"}</span> },
          { id: "addedBy", header: "Added by", defaultHidden: true, cell: (p: PoolListItem) => <span className="text-[13px]">{p.createdBy?.name ?? "—"}</span> },
        ]
      : []),
    { id: "created", header: "Added", sortKey: "createdAt", className: "text-xs text-muted-foreground whitespace-nowrap", cell: (p) => formatDate(p.createdAt) },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      className: "text-right",
      cell: (p) =>
        viewer.isManager ? (
          <ManagerActions row={p} agents={agents} />
        ) : (
          <TakeButton row={p}>
            <Button size="sm">
              <Hand /> Get this lead
            </Button>
          </TakeButton>
        ),
    },
  ];
  return (
    <>
      {selectable && <SelectionBar rows={rows} selected={visible} setSelected={setSelected} agents={agents} />}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        storageKey="leads-pool"
        empty={
          <EmptyState
            icon={Contact}
            title={filtered ? "Nothing matches these filters" : taken ? "No taken leads yet" : "The pool is empty"}
            description={filtered ? "Clear a filter or try another search." : viewer.isManager ? "Import an Excel file, paste a list, or add numbers one by one." : "New numbers appear here when the management adds them."}
          />
        }
      />
    </>
  );
}
