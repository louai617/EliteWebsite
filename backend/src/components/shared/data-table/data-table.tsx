"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface Column<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Server sort key; enables click-to-sort. */
  sortKey?: string;
  className?: string;
  headClassName?: string;
  /** Can the user hide this column? (default true, except the first column) */
  hideable?: boolean;
  defaultHidden?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Row click target — keeps real links inside cells working. */
  rowHref?: (row: T) => string;
  empty?: React.ReactNode;
  /** Persists column visibility per table in localStorage. */
  storageKey?: string;
  toolbarRight?: React.ReactNode;
  className?: string;
}

function readHidden(storageKey: string | undefined, columns: Column<unknown>[]) {
  const defaults = columns.filter((c) => c.defaultHidden).map((c) => c.id);
  if (!storageKey) return defaults;
  try {
    const raw = localStorage.getItem(`elite-crm:cols:${storageKey}`);
    return raw ? (JSON.parse(raw) as string[]) : defaults;
  } catch {
    return defaults;
  }
}

export function DataTable<T>({ columns, rows, rowKey, rowHref, empty, storageKey, className }: DataTableProps<T>) {
  const router = useRouter();
  const url = useUrlState();
  const [hidden, setHidden] = useState<string[]>(() => columns.filter((c) => c.defaultHidden).map((c) => c.id));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore per-browser column preferences after hydration
    setHidden(readHidden(storageKey, columns as Column<unknown>[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const toggleColumn = (id: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (storageKey) {
        try {
          localStorage.setItem(`elite-crm:cols:${storageKey}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  };

  const visible = useMemo(() => columns.filter((c) => !hidden.includes(c.id)), [columns, hidden]);
  const sort = url.get("sort");
  const dir = url.get("dir") ?? "desc";

  const onSort = (key: string) => {
    const nextDir = sort === key ? (dir === "asc" ? "desc" : "asc") : "asc";
    url.set({ sort: key, dir: nextDir });
  };

  const hideable = columns.filter((c, i) => i > 0 && c.hideable !== false);

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(20,16,10,0.04)]", url.pending && "opacity-70 transition-opacity", className)}>
      {storageKey && hideable.length > 0 && (
        <div className="flex justify-end border-b px-2 py-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="text-muted-foreground">
                <Columns3 /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideable.map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={!hidden.includes(c.id)} onCheckedChange={() => toggleColumn(c.id)} onSelect={(e) => e.preventDefault()}>
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {rows.length === 0 ? (
        empty
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {visible.map((col) => {
                const active = col.sortKey && sort === col.sortKey;
                return (
                  <TableHead key={col.id} className={col.headClassName} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                    {col.sortKey ? (
                      <button type="button" onClick={() => onSort(col.sortKey!)} className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground">
                        {col.header}
                        {active ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <TableRow
                  key={rowKey(row)}
                  className={cn(href && "cursor-pointer")}
                  onClick={(e) => {
                    if (!href) return;
                    const target = e.target as HTMLElement;
                    if (target.closest("a,button,[role=menuitem],[role=checkbox],input,select,label")) return;
                    if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
                    else router.push(href);
                  }}
                >
                  {visible.map((col) => (
                    <TableCell key={col.id} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
