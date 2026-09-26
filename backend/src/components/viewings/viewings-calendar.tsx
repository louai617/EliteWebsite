"use client";

import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { tz } from "@date-fns/tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ViewingItem } from "@/services/viewings";
import { useUrlState } from "@/hooks/use-url-state";
import { VIEWING_STATUS_META } from "@/lib/constants";
import { APP_TIMEZONE, formatTime, formatZoned, zonedNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ViewingActions } from "./viewing-actions";

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: "bg-sky-500",
  CONFIRMED: "bg-teal-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-slate-300",
  NO_SHOW: "bg-rose-500",
};

function ViewingChip({ v, agents, viewer }: { v: ViewingItem; agents: AgentOption[]; viewer: Viewer }) {
  const who = v.lead?.fullName ?? v.client?.fullName ?? "—";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-accent",
            (v.status === "CANCELLED" || v.status === "NO_SHOW") && "text-muted-foreground line-through",
          )}
        >
          <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[v.status])} aria-hidden />
          <span className="tabular shrink-0 text-muted-foreground">{formatTime(v.startsAt)}</span>
          <span className="truncate">{v.property.reference}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 text-sm" align="start">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">
              {formatTime(v.startsAt)}–{formatTime(v.endsAt)}
            </p>
            <p className="text-xs text-muted-foreground">{formatZoned(v.startsAt, "EEEE d MMMM")}</p>
          </div>
          <EnumBadge meta={VIEWING_STATUS_META} value={v.status} />
        </div>
        <Link href={`/properties/${v.property.id}`} className="block hover:underline">
          {v.property.reference} · {v.property.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          With{" "}
          {v.lead ? (
            <Link href={`/leads/${v.lead.id}`} className="text-foreground hover:underline">{who}</Link>
          ) : v.client ? (
            <Link href={`/clients/${v.client.id}`} className="text-foreground hover:underline">{who}</Link>
          ) : (
            who
          )}{" "}
          · {v.agent?.name ?? "No agent"}
        </p>
        {v.notes && <p className="rounded bg-muted/60 p-2 text-xs">{v.notes}</p>}
        <div className="flex justify-end">
          <ViewingActions viewing={v} agents={agents} viewer={viewer} trigger={<Button size="xs" variant="outline">Actions</Button>} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ViewingsCalendar({ month, viewings, agents, viewer }: { month: Date; viewings: ViewingItem[]; agents: AgentOption[]; viewer: Viewer }) {
  const url = useUrlState();
  // All calendar maths happens in Doha time so the grid matches the server's data window.
  const inTz = { in: tz(APP_TIMEZONE) };
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month, inTz), { ...inTz, weekStartsOn: 0 }), end: endOfWeek(endOfMonth(month, inTz), { ...inTz, weekStartsOn: 0 }) }, inTz);
  const today = zonedNow();
  const go = (delta: number) => url.set({ month: format(addMonths(month, delta, inTz), "yyyy-MM", inTz) }, { resetPage: false });

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{format(month, "MMMM yyyy", inTz)}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="xs" onClick={() => url.set({ month: undefined }, { resetPage: false })}>
            Today
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => go(-1)} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => go(1)} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="border-b bg-muted/40 px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const items = viewings.filter((v) => isSameDay(v.startsAt, day, inTz));
            const inMonth = isSameMonth(day, month, inTz);
            return (
              <div key={day.toISOString()} className={cn("min-h-28 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/30")}>
                <p className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs", !inMonth && "text-muted-foreground/60", isSameDay(day, today, inTz) && "bg-primary font-semibold text-primary-foreground")}>
                  {format(day, "d", inTz)}
                </p>
                <div className="space-y-0.5">
                  {items.slice(0, 4).map((v) => (
                    <ViewingChip key={v.id} v={v} agents={agents} viewer={viewer} />
                  ))}
                  {items.length > 4 && <p className="px-1 text-[11px] text-muted-foreground">+{items.length - 4} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
