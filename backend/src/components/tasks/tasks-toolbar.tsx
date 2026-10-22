"use client";

import { useUrlState } from "@/hooks/use-url-state";
import { PRIORITY_META, TASK_STATUS_META, TASK_TYPE_META, options } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AgentOption, Viewer } from "@/types/options";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";

const TABS = [
  { value: "", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "done", label: "Completed" },
  { value: "all", label: "All" },
];

export function TasksToolbar({ agents, viewer, counts, showAssignee = false }: { agents: AgentOption[]; viewer: Viewer; counts: Record<string, number>; showAssignee?: boolean }) {
  const url = useUrlState();
  const tab = url.get("tab") ?? "";
  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Task views">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => url.set({ tab: t.value || undefined })}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-[13px] font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
              tab === t.value && "border-gold text-foreground",
            )}
          >
            {t.label}
            {counts[t.value] !== undefined && (
              <span className={cn("tabular rounded px-1.5 text-[11px]", t.value === "overdue" && counts[t.value] > 0 ? "bg-rose-100 text-rose-700" : "bg-secondary")}>{counts[t.value]}</span>
            )}
          </button>
        ))}
      </div>
      <Toolbar>
        <SearchInput placeholder="Search tasks…" />
        {tab === "all" && <FilterSelect param="status" label="Status" options={options(TASK_STATUS_META)} />}
        <FilterSelect param="priority" label="Priority" options={options(PRIORITY_META)} />
        <FilterSelect param="type" label="Type" options={options(TASK_TYPE_META)} />
        {showAssignee && viewer.isManager && (
          <FilterSelect param="assignee" label="Assignee" options={[{ value: "none", label: "Unassigned" }, ...agents.map((a) => ({ value: a.id, label: a.id === viewer.id ? `${a.name} (me)` : a.name }))]} />
        )}
        <ClearFilters params={["q", "status", "priority", "type", "assignee"]} keep={["tab"]} />
      </Toolbar>
    </div>
  );
}
