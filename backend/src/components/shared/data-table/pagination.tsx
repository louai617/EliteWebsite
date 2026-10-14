"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUrlState } from "@/hooks/use-url-state";
import { PAGE_SIZES } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Pagination({ page, pageSize, total, pageCount }: { page: number; pageSize: number; total: number; pageCount: number }) {
  const url = useUrlState();
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col-reverse items-center justify-between gap-3 pt-3 text-[13px] text-muted-foreground sm:flex-row">
      <p className="tabular">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">Rows</span>
        <Select value={String(pageSize)} onValueChange={(v) => url.set({ size: v, page: undefined })}>
          <SelectTrigger size="sm" className="w-[70px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular px-1">
          Page {page} / {pageCount}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page <= 1 || url.pending} onClick={() => url.set({ page: page - 1 }, { resetPage: false })} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" disabled={page >= pageCount || url.pending} onClick={() => url.set({ page: page + 1 }, { resetPage: false })} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
