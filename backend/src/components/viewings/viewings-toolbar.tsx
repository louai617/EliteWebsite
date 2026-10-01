"use client";

import { CalendarDays, Rows3 } from "lucide-react";
import { useUrlState } from "@/hooks/use-url-state";
import { VIEWING_STATUS_META, options } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AgentOption, Viewer } from "@/types/options";
import { ClearFilters, DateRangeFilter, FilterSelect, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";

export function ViewingsToolbar({ agents, viewer, view }: { agents: AgentOption[]; viewer: Viewer; view: "calendar" | "list" }) {
  const url = useUrlState();
  return (
    <Toolbar>
      {view === "list" && <SearchInput placeholder="Search property, client…" />}
      <FilterSelect param="status" label="Status" options={options(VIEWING_STATUS_META)} />
      {viewer.isManager && <FilterSelect param="agent" label="Agent" options={agents.map((a) => ({ value: a.id, label: a.name }))} />}
      {view === "list" && <DateRangeFilter label="Date" />}
      {view === "list" && <FilterSelect param="when" label="Show" options={[{ value: "upcoming", label: "Upcoming only" }]} />}
      <ClearFilters params={["q", "status", "agent", "from", "to", "when"]} keep={["view", "month"]} />
      <div className="ml-auto flex rounded-md border bg-card p-0.5 shadow-xs" role="group" aria-label="View">
        {(["calendar", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => url.set({ view: v === "calendar" ? undefined : v })}
            className={cn("flex h-7 items-center gap-1 rounded px-2 text-xs text-muted-foreground", view === v && "bg-secondary text-foreground")}
            aria-pressed={view === v}
          >
            {v === "calendar" ? <CalendarDays className="size-3.5" /> : <Rows3 className="size-3.5" />}
            {v === "calendar" ? "Calendar" : "List"}
          </button>
        ))}
      </div>
    </Toolbar>
  );
}
