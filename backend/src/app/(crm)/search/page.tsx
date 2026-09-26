import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { param } from "@/lib/list-params";
import { globalSearch } from "@/services/search";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/data-table/toolbar";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const user = await requireUser();
  const q = param(await searchParams, "q") ?? "";
  const groups = q.length >= 2 ? await globalSearch(user, q, 25) : [];
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <PageHeader title="Search" description={q ? `${total} result${total === 1 ? "" : "s"} for “${q}”` : "Search leads, clients, owners, properties and deals"} />
      <div className="mb-4">
        <SearchInput placeholder="Name, phone, e-mail, reference, area…" className="sm:w-96" />
      </div>
      {q.length >= 2 && groups.length === 0 && (
        <Card>
          <EmptyState icon={SearchX} title="No results" description="Try a shorter name, the last 4 digits of a phone number, or a reference like ELT-1012." />
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.kind}>
            <CardHeader>
              <CardTitle>{group.label}</CardTitle>
              <span className="text-xs text-muted-foreground">{group.items.length}</span>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={item.href} className="line-clamp-1 text-sm font-medium hover:underline">
                        {item.title}
                      </Link>
                      {item.subtitle && <p className="line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>}
                    </div>
                    {item.badge && <Badge>{item.badge}</Badge>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
