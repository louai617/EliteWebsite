"use client";

import { useUrlState } from "@/hooks/use-url-state";
import { CUSTOMER_TYPE_META, PURPOSE_META, options } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";

export function PoolToolbar({
  isManager,
  taken,
  counts,
  batches,
}: {
  isManager: boolean;
  taken: boolean;
  counts: { available: number; taken: number };
  batches: { batch: string; available: number }[];
}) {
  const url = useUrlState();
  return (
    <Toolbar>
      <SearchInput placeholder={isManager ? "Search name, number, area, notes…" : "Search name, area, notes…"} />
      <FilterSelect param="type" label="Who" options={options(CUSTOMER_TYPE_META)} />
      <FilterSelect param="purpose" label="Rent / sale" options={options(PURPOSE_META)} />
      {isManager && batches.length > 0 && <FilterSelect param="batch" label="From" options={batches.map((b) => ({ value: b.batch, label: `${b.batch} (${b.available})` }))} className="max-w-[320px]" />}
      <ClearFilters params={["q", "type", "purpose", "batch"]} keep={["status", "size"]} />
      {isManager && (
        <div className="ml-auto flex rounded-md border bg-card p-0.5 shadow-xs" role="group" aria-label="Show">
          {([
            ["available", `In the pool (${counts.available})`],
            ["taken", `Taken (${counts.taken})`],
          ] as const).map(([value, label]) => {
            const active = (value === "taken") === taken;
            return (
              <button
                key={value}
                type="button"
                onClick={() => url.set({ status: value === "taken" ? "taken" : undefined, page: undefined })}
                className={cn("flex h-7 items-center rounded px-2 text-xs text-muted-foreground", active && "bg-secondary text-foreground")}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </Toolbar>
  );
}
