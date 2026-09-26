"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, GripVertical, MoreHorizontal, Phone } from "lucide-react";
import type { LeadStatus } from "@/generated/prisma/enums";
import type { LeadListItem } from "@/services/leads";
import { setLeadStatusAction } from "@/actions/leads";
import { LEAD_PIPELINE, LEAD_SOURCE_META, LEAD_STATUS_META, PRIORITY_META } from "@/lib/constants";
import { formatMoneyCompact } from "@/lib/format";
import { RelativeTime } from "@/components/shared/relative-time";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";

export interface BoardColumn {
  status: LeadStatus;
  items: LeadListItem[];
  total: number;
}

type Move = { id: string; to: LeadStatus };

const COLUMN_ACCENT: Record<LeadStatus, string> = {
  NEW: "bg-sky-500",
  CONTACTED: "bg-teal-500",
  QUALIFIED: "bg-violet-500",
  VIEWING_SCHEDULED: "bg-amber-500",
  NEGOTIATION: "bg-[#b98f42]",
  WON: "bg-emerald-500",
  LOST: "bg-rose-400",
};

function applyMove(columns: BoardColumn[], move: Move): BoardColumn[] {
  const card = columns.flatMap((c) => c.items).find((i) => i.id === move.id);
  if (!card || card.status === move.to) return columns;
  return columns.map((col) => {
    if (col.status === card.status) return { ...col, items: col.items.filter((i) => i.id !== move.id), total: col.total - 1 };
    if (col.status === move.to) return { ...col, items: [{ ...card, status: move.to, statusChangedAt: new Date() }, ...col.items], total: col.total + 1 };
    return col;
  });
}

function LeadCard({ lead, onMove, dragging, onDragStart, onDragEnd }: { lead: LeadListItem; onMove: (to: LeadStatus) => void; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const priority = PRIORITY_META[lead.priority];
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/lead-id", lead.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn("group rounded-md border bg-card p-3 shadow-[0_1px_2px_rgba(20,16,10,0.05)] transition-shadow hover:shadow-md", dragging && "opacity-40")}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 -ml-1 size-3.5 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${lead.id}`} className="line-clamp-1 text-[13px] font-medium hover:underline">
            {lead.fullName}
          </Link>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {[lead.interestedArea, lead.bedrooms != null ? (lead.bedrooms === 0 ? "Studio" : `${lead.bedrooms}BR`) : null, lead.purpose === "RENT" ? "Rent" : lead.purpose === "SALE" ? "Buy" : null]
              .filter(Boolean)
              .join(" · ") || "No requirements yet"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="-mt-1 -mr-1 text-muted-foreground" aria-label={`Move ${lead.fullName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={lead.status} onValueChange={(v) => onMove(v as LeadStatus)}>
              {LEAD_PIPELINE.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {LEAD_STATUS_META[s].label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {(lead.priority === "HIGH" || lead.priority === "URGENT") && <Badge tone={priority.tone}>{priority.label}</Badge>}
        <Badge tone="neutral">{LEAD_SOURCE_META[lead.source].label}</Badge>
        {lead.budgetMax != null && <span className="tabular text-xs text-muted-foreground">≤ {formatMoneyCompact(lead.budgetMax)}</span>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <UserAvatar user={lead.agent} className="size-5" />
          <span className="truncate">{lead.agent?.name ?? "Unassigned"}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {lead._count.viewings > 0 && (
            <span className="flex items-center gap-0.5" title="Viewings">
              <CalendarClock className="size-3" /> {lead._count.viewings}
            </span>
          )}
          <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="hover:text-foreground" aria-label={`Call ${lead.fullName}`}>
            <Phone className="size-3" />
          </a>
          <RelativeTime date={lead.statusChangedAt} />
        </span>
      </div>
    </article>
  );
}

export function LeadBoard({ columns }: { columns: BoardColumn[] }) {
  const [optimistic, addMove] = useOptimistic(columns, applyMove);
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);

  const move = (id: string, to: LeadStatus) => {
    const card = optimistic.flatMap((c) => c.items).find((i) => i.id === id);
    if (!card || card.status === to) return;
    startTransition(async () => {
      addMove({ id, to });
      const result = await setLeadStatusAction({ id, status: to });
      if (result.ok) toast.success(`${card.fullName} → ${LEAD_STATUS_META[to].label}`);
      else toast.error(result.error);
    });
  };

  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:-mx-5 sm:px-5 lg:-mx-7 lg:px-7">
      <div className="flex min-h-[60vh] gap-3" role="list" aria-label="Lead pipeline">
        {optimistic.map((col) => (
          <section
            key={col.status}
            role="listitem"
            aria-label={`${LEAD_STATUS_META[col.status].label}: ${col.total} leads`}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== col.status) setOver(col.status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/lead-id");
              setOver(null);
              setDragId(null);
              if (id) move(id, col.status);
            }}
            className={cn("flex w-[272px] shrink-0 flex-col rounded-lg border bg-muted/50 transition-colors", over === col.status && "border-foreground/30 bg-accent")}
          >
            <header className="flex items-center gap-2 px-3 py-2.5">
              <span className={cn("size-2 rounded-full", COLUMN_ACCENT[col.status])} aria-hidden />
              <h2 className="text-[13px] font-semibold">{LEAD_STATUS_META[col.status].label}</h2>
              <span className="tabular ml-auto rounded bg-card px-1.5 text-xs text-muted-foreground">{col.total}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {col.items.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  dragging={dragId === lead.id}
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  onMove={(to) => move(lead.id, to)}
                />
              ))}
              {col.items.length === 0 && <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Drop leads here</p>}
              {col.total > col.items.length && (
                <Link href={`/leads?view=table&status=${col.status}`} className="py-1 text-center text-xs text-muted-foreground hover:text-foreground">
                  +{col.total - col.items.length} more in table view
                </Link>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
