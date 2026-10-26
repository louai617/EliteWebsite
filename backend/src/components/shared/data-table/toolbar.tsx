"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Debounced search box bound to ?q= */
export function SearchInput({ placeholder = "Search…", param = "q", className }: { placeholder?: string; param?: string; className?: string }) {
  const url = useUrlState();
  const current = url.get(param) ?? "";
  const [value, setValue] = useState(current);
  const [synced, setSynced] = useState(current);

  // Keep the box in sync when the URL changes elsewhere (e.g. "Clear filters").
  if (current !== synced) {
    setSynced(current);
    setValue(current);
  }

  useEffect(() => {
    if (value === current) return;
    const t = setTimeout(() => url.set({ [param]: value.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-8 pr-8 pl-8 text-[13px]" aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => setValue("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

const ALL = "__all__";

/** Single-select filter bound to a URL param. */
export function FilterSelect({ param, label, options, className }: { param: string; label: string; options: { value: string; label: string }[]; className?: string }) {
  const url = useUrlState();
  const value = url.get(param) ?? ALL;
  return (
    <Select value={value} onValueChange={(v) => url.set({ [param]: v === ALL ? undefined : v })}>
      <SelectTrigger size="sm" className={cn("w-auto min-w-[120px] gap-1.5 text-[13px]", value !== ALL && "border-foreground/25 bg-accent", className)} aria-label={label}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Min/max numeric filter (e.g. price, budget) bound to two URL params. */
export function RangeFilter({ minParam, maxParam, label, placeholderMin = "Min", placeholderMax = "Max" }: { minParam: string; maxParam: string; label: string; placeholderMin?: string; placeholderMax?: string }) {
  const url = useUrlState();
  const [min, setMin] = useState(url.get(minParam) ?? "");
  const [max, setMax] = useState(url.get(maxParam) ?? "");
  const apply = () => url.set({ [minParam]: min.replace(/[^0-9]/g, "") || undefined, [maxParam]: max.replace(/[^0-9]/g, "") || undefined });
  return (
    <div className="flex items-center gap-1 rounded-md border bg-card px-2 shadow-xs" role="group" aria-label={label}>
      <span className="text-[13px] whitespace-nowrap text-muted-foreground">{label}</span>
      <input
        inputMode="numeric"
        value={min}
        onChange={(e) => setMin(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder={placeholderMin}
        className="h-8 w-20 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
        aria-label={`${label} minimum`}
      />
      <span className="text-muted-foreground">–</span>
      <input
        inputMode="numeric"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder={placeholderMax}
        className="h-8 w-20 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
        aria-label={`${label} maximum`}
      />
    </div>
  );
}

/** Date range filter bound to ?from= & ?to= (yyyy-mm-dd). */
export function DateRangeFilter({ label = "Date", fromParam = "from", toParam = "to" }: { label?: string; fromParam?: string; toParam?: string }) {
  const url = useUrlState();
  return (
    <div className="flex items-center gap-1 rounded-md border bg-card px-2 shadow-xs" role="group" aria-label={label}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <input type="date" value={url.get(fromParam) ?? ""} onChange={(e) => url.set({ [fromParam]: e.target.value || undefined })} className="h-8 bg-transparent text-[13px] outline-none" aria-label={`${label} from`} />
      <span className="text-muted-foreground">–</span>
      <input type="date" value={url.get(toParam) ?? ""} onChange={(e) => url.set({ [toParam]: e.target.value || undefined })} className="h-8 bg-transparent text-[13px] outline-none" aria-label={`${label} to`} />
    </div>
  );
}

/** Shows "Clear" when any of the given params are set. */
export function ClearFilters({ params, keep = [] }: { params: string[]; keep?: string[] }) {
  const url = useUrlState();
  const active = params.some((p) => url.get(p));
  if (!active) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => url.clear(keep)} className="text-muted-foreground">
      <X /> Clear
    </Button>
  );
}

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-3 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
