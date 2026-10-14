import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { CheckCircle2, CircleDashed, History } from "lucide-react";
import { ExternalSource } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { enumParam, param } from "@/lib/list-params";
import { EXTERNAL_SOURCE_META, IMPORT_RUN_STATUS_META, options } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { integrationStatus, listImportRuns } from "@/services/imports";
import { listAssignableUsers } from "@/services/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/data-table/pagination";
import { FilterSelect, Toolbar } from "@/components/shared/data-table/toolbar";
import { ImportPanel } from "@/components/imports/import-panel";

export const metadata: Metadata = { title: "Imports" };

export default async function ImportsPage({ searchParams }: PageProps<"/imports">) {
  const user = await requireUser();
  if (!hasPermission(user, "imports.run")) forbidden();
  const sp = await searchParams;
  const page = Math.max(1, Number(param(sp, "page")) || 1);
  const source = enumParam(sp, "source", ExternalSource);
  const [statuses, runs, agents] = await Promise.all([
    Promise.all((Object.keys(ExternalSource) as ExternalSource[]).map((s) => integrationStatus(user, s))),
    listImportRuns(user, { source, page, pageSize: 20 }),
    listAssignableUsers(),
  ]);

  return (
    <>
      <PageHeader title="Imports" description="Bring listings in from Property Finder and Qatar Living. Imports are validated, de-duplicated and logged record by record." />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {statuses.map((s) => (
          <Card key={s.source}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <EnumBadge meta={EXTERNAL_SOURCE_META} value={s.source} />
              </CardTitle>
              <span className="text-xs text-muted-foreground">{s.linkedListings} linked listing(s)</span>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-1 text-xs">
                {s.env.map((e) => (
                  <li key={e.name} className="flex items-center gap-2">
                    {e.set ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <CircleDashed className="size-3.5 text-muted-foreground" />}
                    <code className="font-mono">{e.name}</code>
                    <span className="text-muted-foreground">{e.set ? "set" : "not set"}</span>
                  </li>
                ))}
              </ul>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {s.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <ImportPanel source={s.source} remoteConfigured={s.remoteConfigured} agents={agents} />
              {s.lastRun && (
                <p className="text-xs text-muted-foreground">
                  Last import{" "}
                  <Link href={`/imports/${s.lastRun.id}`} className="font-medium text-foreground hover:underline">
                    {formatDateTime(s.lastRun.startedAt)}
                  </Link>{" "}
                  · {s.lastRun.created} created, {s.lastRun.updated} updated, {s.lastRun.failed} failed
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Toolbar>
        <FilterSelect param="source" label="Source" options={options(EXTERNAL_SOURCE_META)} />
      </Toolbar>
      <Card className="overflow-hidden">
        {runs.items.length === 0 ? (
          <EmptyState icon={History} title="No imports yet" description="Upload a JSON export above. Start with a dry run to preview what will happen." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Started</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Unchanged</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="pr-4">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 whitespace-nowrap">
                    <Link href={`/imports/${r.id}`} className="font-medium hover:underline">
                      {formatDateTime(r.startedAt)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <EnumBadge meta={EXTERNAL_SOURCE_META} value={r.source} />
                  </TableCell>
                  <TableCell>
                    <EnumBadge meta={IMPORT_RUN_STATUS_META} value={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.dryRun ? "Dry run" : "Import"} · {r.trigger}
                  </TableCell>
                  <TableCell className="tabular text-right">{r.total}</TableCell>
                  <TableCell className="tabular text-right">{r.created}</TableCell>
                  <TableCell className="tabular text-right">{r.updated}</TableCell>
                  <TableCell className="tabular text-right">{r.unchanged}</TableCell>
                  <TableCell className="tabular text-right">{r.skipped}</TableCell>
                  <TableCell className={r.failed ? "tabular text-right font-medium text-rose-600" : "tabular text-right"}>{r.failed}</TableCell>
                  <TableCell className="pr-4 text-xs text-muted-foreground">{r.startedBy?.name ?? "System"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination page={runs.page} pageSize={runs.pageSize} total={runs.total} pageCount={runs.pageCount} />
    </>
  );
}
