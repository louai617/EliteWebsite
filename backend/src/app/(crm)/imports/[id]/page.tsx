import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { ImportRecordStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { enumParam } from "@/lib/list-params";
import { EXTERNAL_SOURCE_META, IMPORT_RECORD_STATUS_META, IMPORT_RUN_STATUS_META, options } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { getImportRun } from "@/services/imports";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { InfoList } from "@/components/shared/info-list";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect, Toolbar } from "@/components/shared/data-table/toolbar";

export const metadata: Metadata = { title: "Import run" };

export default async function ImportRunPage({ params, searchParams }: PageProps<"/imports/[id]">) {
  const user = await requireUser();
  if (!hasPermission(user, "imports.run")) forbidden();
  const { id } = await params;
  const status = enumParam(await searchParams, "status", ImportRecordStatus);
  let run;
  try {
    run = await getImportRun(user, id, status);
  } catch {
    notFound();
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Imports", href: "/imports" }, { label: formatDateTime(run.startedAt) }]}
        title={`${EXTERNAL_SOURCE_META[run.source].label} ${run.dryRun ? "dry run" : "import"}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <EnumBadge meta={IMPORT_RUN_STATUS_META} value={run.status} dot />
            {run.dryRun && <span>Preview only — nothing was saved.</span>}
          </span>
        }
      />
      <Card>
        <CardContent className="pt-5">
          <InfoList
            columns={3}
            items={[
              { label: "Started", value: formatDateTime(run.startedAt) },
              { label: "Finished", value: run.finishedAt && formatDateTime(run.finishedAt) },
              { label: "Started by", value: run.startedBy?.name ?? "System" },
              { label: "Trigger", value: run.trigger },
              { label: "Records", value: run.total },
              { label: "Result", value: `${run.created} created · ${run.updated} updated · ${run.unchanged} unchanged · ${run.skipped} skipped · ${run.failed} failed` },
              { label: "Error", value: run.error, hidden: !run.error },
            ]}
          />
        </CardContent>
      </Card>
      <Toolbar>
        <FilterSelect param="status" label="Result" options={options(IMPORT_RECORD_STATUS_META)} />
      </Toolbar>
      <Card className="overflow-hidden">
        {run.records.length === 0 ? (
          <EmptyState compact title="No records" description={status ? "No records with this result." : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-14 pl-4">#</TableHead>
                <TableHead>Listing ID</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="pr-4">Property</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular pl-4 text-muted-foreground">{r.position}</TableCell>
                  <TableCell className="font-mono text-xs">{r.externalId ?? "—"}</TableCell>
                  <TableCell>
                    <EnumBadge meta={IMPORT_RECORD_STATUS_META} value={r.status} />
                  </TableCell>
                  <TableCell className="max-w-md text-sm whitespace-normal">{r.message}</TableCell>
                  <TableCell className="pr-4">
                    {r.propertyId ? (
                      <Link href={`/properties/${r.propertyId}`} className="text-sm hover:underline">
                        Open
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
