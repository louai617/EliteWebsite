"use client";

import { Kanban, Rows3 } from "lucide-react";
import { useUrlState } from "@/hooks/use-url-state";
import { LEAD_SOURCE_META, LEAD_STATUS_META, PRIORITY_META, PURPOSE_META, options } from "@/lib/constants";
import type { AgentOption, Viewer } from "@/types/options";
import { cn } from "@/lib/utils";
import { ClearFilters, DateRangeFilter, FilterSelect, RangeFilter, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";

const FILTERS = ["q", "status", "source", "priority", "purpose", "agent", "from", "to", "budgetMin", "budgetMax"];

export function LeadsToolbar({ agents, viewer, view }: { agents: AgentOption[]; viewer: Viewer; view: "board" | "table" }) {
  const url = useUrlState();
  return (
    <Toolbar>
      <SearchInput placeholder="Search name, phone, area…" />
      {view === "table" && <FilterSelect param="status" label="Status" options={options(LEAD_STATUS_META)} />}
      <FilterSelect param="source" label="Source" options={options(LEAD_SOURCE_META)} />
      <FilterSelect param="priority" label="Priority" options={options(PRIORITY_META)} />
      <FilterSelect param="purpose" label="Purpose" options={options(PURPOSE_META)} />
      {viewer.isManager && (
        <FilterSelect param="agent" label="Agent" options={[{ value: "none", label: "Unassigned" }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />
      )}
      <DateRangeFilter label="Created" />
      <RangeFilter minParam="budgetMin" maxParam="budgetMax" label="Budget" />
      <ClearFilters params={FILTERS} keep={["view", "size"]} />
      <div className="ml-auto flex rounded-md border bg-card p-0.5 shadow-xs" role="group" aria-label="View">
        {(["board", "table"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => url.set({ view: v === "board" ? undefined : v, status: undefined })}
            className={cn("flex h-7 items-center gap-1 rounded px-2 text-xs text-muted-foreground", view === v && "bg-secondary text-foreground")}
            aria-pressed={view === v}
          >
            {v === "board" ? <Kanban className="size-3.5" /> : <Rows3 className="size-3.5" />}
            {v === "board" ? "Pipeline" : "Table"}
          </button>
        ))}
      </div>
    </Toolbar>
  );
}
