import type { Metadata } from "next";
import { CustomerType, ListingPurpose } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { enumParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { listPool, POOL_SORTS, poolBatches, poolCounts } from "@/services/leads-pool";
import { listAssignableUsers } from "@/services/users";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { AddPoolLeadButton } from "@/components/leads-pool/pool-form";
import { PoolBulkButton } from "@/components/leads-pool/pool-bulk";
import { PoolImportButton } from "@/components/leads-pool/pool-import";
import { PoolTable } from "@/components/leads-pool/pool-table";
import { PoolToolbar } from "@/components/leads-pool/pool-toolbar";

export const metadata: Metadata = { title: "Leads pool" };

export default async function LeadsPoolPage({ searchParams }: PageProps<"/leads-pool">) {
  const user = await requireUser();
  const sp = await searchParams;
  const viewer = toViewer(user);
  const taken = viewer.isManager && param(sp, "status") === "taken";
  const params = listParams(sp, POOL_SORTS, { sort: "createdAt" });
  const filters = {
    status: taken ? ("TAKEN" as const) : ("AVAILABLE" as const),
    leadType: enumParam(sp, "type", CustomerType),
    purpose: enumParam(sp, "purpose", ListingPurpose),
    batch: param(sp, "batch")?.slice(0, 120),
  };
  const [result, counts, batches, agents] = await Promise.all([
    listPool(user, params, filters),
    poolCounts(user),
    poolBatches(user),
    viewer.isManager ? listAssignableUsers() : [],
  ]);
  const filtered = Boolean(params.q || filters.leadType || filters.purpose || filters.batch);

  return (
    <>
      <PageHeader
        title="Leads pool"
        description={
          viewer.isManager
            ? "Numbers waiting for an agent. Agents see them masked; when one presses “Get this lead” it's theirs. You can also tick numbers and give them to an agent."
            : "Numbers from the management. Press “Get this lead” and it's yours right away — it moves to your Leads page with the full number."
        }
        actions={
          viewer.isManager ? (
            <>
              <PoolImportButton />
              <PoolBulkButton />
              <AddPoolLeadButton />
            </>
          ) : undefined
        }
      />
      <PoolToolbar isManager={viewer.isManager} taken={taken} counts={counts} batches={batches} />
      <PoolTable rows={result.items} viewer={viewer} agents={agents} filtered={filtered} taken={taken} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
