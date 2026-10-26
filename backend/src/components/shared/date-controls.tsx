"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUrlState } from "@/hooks/use-url-state";
import { RANGE_PRESETS, RANGE_PRESET_LABELS, isBusinessDate, shiftDate, type DateRange } from "@/lib/business-day";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** ‹ date › stepper for single-day views (daily tasks, daily report history). */
export function DayStepper({ date, today, param = "date" }: { date: string; today: string; param?: string }) {
  const url = useUrlState();
  const go = (d: string) => url.set({ [param]: d === today ? undefined : d });
  return (
    <div className={cn("flex items-center gap-1", url.pending && "opacity-70")}>
      <Button variant="outline" size="icon-sm" onClick={() => go(shiftDate(date, -1))} aria-label="Previous day">
        <ChevronLeft />
      </Button>
      <Input
        type="date"
        value={date}
        max={today}
        onChange={(e) => isBusinessDate(e.target.value) && e.target.value <= today && go(e.target.value)}
        className="h-8 w-40"
        aria-label="Date"
      />
      <Button variant="outline" size="icon-sm" onClick={() => go(shiftDate(date, 1))} disabled={date >= today} aria-label="Next day">
        <ChevronRight />
      </Button>
      {date !== today && (
        <Button variant="ghost" size="sm" onClick={() => go(today)}>
          Today
        </Button>
      )}
    </div>
  );
}

/** Today / Yesterday / This week / This month / Custom range selector. */
export function RangePicker({ range, today }: { range: DateRange; today: string }) {
  const url = useUrlState();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", url.pending && "opacity-70")}>
      <div className="inline-flex rounded-md border bg-card p-0.5 shadow-xs" role="group" aria-label="Period">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={range.preset === p}
            onClick={() => url.set(p === "custom" ? { range: p, from: range.from, to: range.to } : { range: p === "today" ? undefined : p, from: undefined, to: undefined })}
            className={cn("rounded px-2.5 py-1 text-[13px] font-medium whitespace-nowrap text-muted-foreground hover:text-foreground", range.preset === p && "bg-secondary text-foreground")}
          >
            {RANGE_PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {range.preset === "custom" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Input type="date" value={range.from} max={today} onChange={(e) => isBusinessDate(e.target.value) && url.set({ from: e.target.value })} className="h-8 w-38" aria-label="From" />
          <span>to</span>
          <Input type="date" value={range.to} max={today} onChange={(e) => isBusinessDate(e.target.value) && url.set({ to: e.target.value })} className="h-8 w-38" aria-label="To" />
        </div>
      )}
    </div>
  );
}
