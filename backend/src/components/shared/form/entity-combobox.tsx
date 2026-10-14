"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import type { LookupOption } from "@/types/search";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type LookupKind = "property" | "lead" | "client" | "owner" | "deal";

async function fetchOptions(kind: LookupKind, params: Record<string, string>, signal?: AbortSignal) {
  const res = await fetch(`/api/lookup/${kind}?${new URLSearchParams(params)}`, { signal });
  if (!res.ok) throw new Error(`lookup ${res.status}`);
  return ((await res.json()) as { options: LookupOption[] }).options;
}

/**
 * Searchable, server-backed picker for related records. Only matching rows are fetched,
 * so it scales to thousands of properties or leads.
 */
export function EntityCombobox({
  kind,
  value,
  onChange,
  placeholder = "Select…",
  initialOption,
  disabled,
  invalid,
  clearable = true,
  id,
}: {
  kind: LookupKind;
  value: string | null | undefined;
  onChange: (value: string | null, option: LookupOption | null) => void;
  placeholder?: string;
  initialOption?: LookupOption | null;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<LookupOption | null>(initialOption ?? null);

  // Resolve the label for a preselected id that we don't have a label for.
  useEffect(() => {
    if (!value || selected?.id === value) return;
    const ac = new AbortController();
    fetchOptions(kind, { id: value }, ac.signal)
      .then((opts) => setSelected(opts[0] ?? null))
      .catch(() => undefined);
    return () => ac.abort();
  }, [kind, value, selected?.id]);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetchOptions(kind, { q: query }, ac.signal)
        .then(setOptions)
        .catch(() => undefined)
        .finally(() => !ac.signal.aborted && setLoading(false));
    }, 150);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [kind, query, open]);

  const current = value ? (selected?.id === value ? selected : null) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid}
            disabled={disabled}
            className={cn("w-full justify-between px-3 font-normal aria-invalid:border-destructive", !current && "text-muted-foreground/70")}
          >
            <span className="truncate">{current ? current.label : value ? "Loading…" : placeholder}</span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        {clearable && current && !disabled && (
          <button
            type="button"
            className="absolute top-1/2 right-8 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSelected(null);
              onChange(null, null);
            }}
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Type to search…" />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-5 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {!loading && <CommandEmpty>No matches.</CommandEmpty>}
            {!loading && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      setSelected(option);
                      onChange(option.id, option);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === option.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <p className="truncate">{option.label}</p>
                      {option.hint && <p className="truncate text-xs text-muted-foreground">{option.hint}</p>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
