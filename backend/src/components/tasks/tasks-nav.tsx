"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/types/options";

/** My tasks · Team tasks (managers) · Daily tasks. */
export function TasksNav({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const links = [
    { href: "/tasks", label: "My tasks" },
    ...(viewer.isManager ? [{ href: "/tasks/team", label: "Team tasks" }] : []),
    { href: "/tasks/daily", label: "Daily tasks" },
  ];
  return (
    <nav className="inline-flex rounded-md border bg-card p-0.5 shadow-xs" aria-label="Task views">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn("rounded px-3 py-1 text-[13px] font-medium text-muted-foreground hover:text-foreground", active && "bg-secondary text-foreground")}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
