"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Handshake, KeyRound, Loader2, UserCog, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import type { SearchGroup, SearchKind } from "@/types/search";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { visibleNav, type NavItem } from "./nav";

const KIND_ICON: Record<SearchKind, LucideIcon> = {
  lead: UsersRound,
  client: UserRound,
  owner: KeyRound,
  property: Building2,
  deal: Handshake,
  user: UserCog,
};

export function CommandMenu({ open, onOpenChange, user }: { open: boolean; onOpenChange: (open: boolean) => void; user: SessionUser }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // ⌘K / Ctrl+K and "/" open the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Debounced server search. State is only updated from the async callback.
  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < 2) return;
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { groups: SearchGroup[] };
        setGroups(data.groups);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setGroups([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [trimmed]);

  const visibleGroups = trimmed.length < 2 ? [] : groups;

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  // Every reachable page, including nested sections ("Properties › Commercial › Company").
  const navItems = visibleNav(user).flatMap((g) => flattenNav(g.items));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Search the CRM">
      {/* Results are already filtered on the server, so disable cmdk's own fuzzy filter. */}
      <div className="contents [&_[cmdk-root]]:h-full">
        <CommandRoot query={query} setQuery={setQuery} loading={loading}>
          {trimmed.length >= 2 && !loading && visibleGroups.length === 0 && <CommandEmpty>No matches for “{trimmed}”.</CommandEmpty>}
          {visibleGroups.map((group) => {
            const Icon = KIND_ICON[group.kind];
            return (
              <CommandGroup key={group.kind} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem key={`${group.kind}-${item.id}`} value={`${group.kind}-${item.id}`} onSelect={() => go(item.href)}>
                    <Icon />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{item.title}</p>
                      {item.subtitle && <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>}
                    </div>
                    {item.badge && <CommandShortcut className="tracking-normal">{item.badge}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
          {visibleGroups.length > 0 && (
            <CommandItem value="all-results" onSelect={() => go(`/search?q=${encodeURIComponent(trimmed)}`)}>
              <span className="text-muted-foreground">See all results for “{trimmed}”</span>
            </CommandItem>
          )}
          {trimmed.length < 2 && (
            <>
              <CommandGroup heading="Go to">
                {navItems.map((item) => (
                  <CommandItem key={item.href} value={`nav-${item.href}`} onSelect={() => go(item.href)}>
                    {item.icon && <item.icon />} {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Create">
                <CommandItem value="create-lead" onSelect={() => go("/leads?new=1")}>New lead</CommandItem>
                <CommandItem value="create-property" onSelect={() => go("/properties/new")}>New property</CommandItem>
                <CommandItem value="create-viewing" onSelect={() => go("/viewings?new=1")}>Schedule viewing</CommandItem>
                <CommandItem value="create-task" onSelect={() => go("/tasks?new=1")}>New task</CommandItem>
                <CommandItem value="log-activity" onSelect={() => go("/tasks?log=1")}>Log activity (call, follow-up…)</CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandRoot>
      </div>
    </CommandDialog>
  );
}

function CommandRoot({ query, setQuery, loading, children }: { query: string; setQuery: (q: string) => void; loading: boolean; children: React.ReactNode }) {
  return (
    <Command shouldFilter={false} loop>
      <div className="relative">
        <CommandInput value={query} onValueChange={setQuery} placeholder="Search by name, phone, reference, area…" />
        {loading && <Loader2 className="absolute top-3.5 right-3 size-4 animate-spin text-muted-foreground" />}
      </div>
      <CommandList>{children}</CommandList>
    </Command>
  );
}

function flattenNav(items: NavItem[], parents: string[] = [], icon?: NavItem["icon"]): { href: string; label: string; icon?: NavItem["icon"] }[] {
  const seen = new Set<string>();
  const out: { href: string; label: string; icon?: NavItem["icon"] }[] = [];
  for (const item of items) {
    const label = [...parents, item.label].join(" › ");
    if (!seen.has(item.href)) {
      seen.add(item.href);
      out.push({ href: item.href, label: item.children && parents.length === 0 ? item.label : label, icon: item.icon ?? icon });
    }
    if (item.children) {
      for (const child of flattenNav(item.children, [...parents, item.label], item.icon ?? icon)) {
        if (!seen.has(child.href)) {
          seen.add(child.href);
          out.push(child);
        }
      }
    }
  }
  return out;
}
