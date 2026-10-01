"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import { useUrlState } from "@/hooks/use-url-state";
import { FURNISHING_META, PROPERTY_CATEGORY_META, PROPERTY_STATUS_META, PROPERTY_SUBCATEGORY_META, PROPERTY_TYPE_META, PURPOSE_META, options } from "@/lib/constants";
import type { AgentOption, Viewer } from "@/types/options";
import { cn } from "@/lib/utils";
import { ClearFilters, FilterSelect, RangeFilter, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";

const FILTER_KEYS = ["q", "category", "subcategory", "status", "purpose", "type", "area", "priceMin", "priceMax", "beds", "furnishing", "agent", "featured"];

export function PropertiesToolbar({ areas, agents, viewer }: { areas: string[]; agents: AgentOption[]; viewer: Viewer }) {
  const url = useUrlState();
  const view = url.get("view") === "grid" ? "grid" : "table";
  return (
    <Toolbar>
      <SearchInput placeholder="Search title, ref, building…" />
      <FilterSelect param="category" label="Category" options={options(PROPERTY_CATEGORY_META)} />
      <FilterSelect param="subcategory" label="Listed by" options={options(PROPERTY_SUBCATEGORY_META)} />
      <FilterSelect param="status" label="Status" options={options(PROPERTY_STATUS_META)} />
      <FilterSelect param="purpose" label="Purpose" options={options(PURPOSE_META)} />
      <FilterSelect param="type" label="Type" options={options(PROPERTY_TYPE_META)} />
      <FilterSelect param="area" label="Area" options={areas.map((a) => ({ value: a, label: a }))} />
      <FilterSelect
        param="beds"
        label="Beds"
        options={[{ value: "0", label: "Studio" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}+` }))]}
      />
      <RangeFilter minParam="priceMin" maxParam="priceMax" label="Price" />
      <FilterSelect param="furnishing" label="Furnishing" options={options(FURNISHING_META)} />
      <FilterSelect
        param="agent"
        label="Agent"
        options={[...(viewer.isManager ? [{ value: "none", label: "Unassigned" }] : []), ...agents.map((a) => ({ value: a.id, label: a.id === viewer.id ? `${a.name} (me)` : a.name }))]}
      />
      <ClearFilters params={FILTER_KEYS} keep={["view", "size"]} />
      <div className="ml-auto flex rounded-md border bg-card p-0.5 shadow-xs" role="group" aria-label="View">
        {(["table", "grid"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => url.set({ view: v === "table" ? undefined : v }, { resetPage: false })}
            className={cn("flex h-7 items-center gap-1 rounded px-2 text-xs text-muted-foreground", view === v && "bg-secondary text-foreground")}
            aria-pressed={view === v}
          >
            {v === "table" ? <Rows3 className="size-3.5" /> : <LayoutGrid className="size-3.5" />}
            {v === "table" ? "Table" : "Grid"}
          </button>
        ))}
      </div>
    </Toolbar>
  );
}
