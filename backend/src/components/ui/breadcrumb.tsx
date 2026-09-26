import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const parent = [...items].reverse().find((item, i) => i > 0 && item.href);
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      {/* Phones: a single back link to the parent instead of the full trail. */}
      {parent?.href && (
        <Link href={parent.href} className="inline-flex items-center gap-0.5 text-[13px] text-muted-foreground hover:text-foreground sm:hidden">
          <ChevronLeft className="size-3.5" /> {parent.label}
        </Link>
      )}
      <ol className="hidden min-w-0 items-center gap-1 text-[13px] text-muted-foreground sm:flex">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="truncate transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span className={cn("truncate", last && "font-medium text-foreground")} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumbs };
