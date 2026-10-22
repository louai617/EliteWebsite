import type { Metadata } from "next";
import { CustomerType, ListingPurpose } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { enumParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { listMyPoolRequests, listPendingPoolRequests, listPool, MAX_PENDING_REQUESTS, POOL_SORTS, poolCounts } from "@/services/leads-pool";
import { listAssignableUsers } from "@/services/users";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { AddPoolLeadButton } from "@/components/leads-pool/pool-form";
import { PoolBulkButton } from "@/components/leads-pool/pool-bulk";
import { MyPoolRequests, PendingPoolRequests } from "@/components/leads-pool/pool-requests";
import { PoolTable } from "@/components/leads-pool/pool-table";
import { PoolToolbar } from "@/components/leads-pool/pool-toolbar";

export const metadata: Metadata = { title: "Leads pool" };

export default async function LeadsPoolPage({ searchParams }: PageProps<"/leads-pool">) {
  const user = await requireUser();
  const sp = await searchParams;
  const viewer = toViewer(user);
  const taken = viewer.isManager && param(sp, "status") === "taken";
  const params = listParams(sp, POOL_SORTS, { sort: "createdAt" });
  const filters = { status: taken ? ("TAKEN" as const) : ("AVAILABLE" as const), leadType: enumParam(sp, "type", CustomerType), purpose: enumParam(sp, "purpose", ListingPurpose) };
  const [result, counts, pending, mine, agents] = await Promise.all([
    listPool(user, params, filters),
    poolCounts(user),
    listPendingPoolRequests(user),
    viewer.isManager ? [] : listMyPoolRequests(user),
    viewer.isManager ? listAssignableUsers() : [],
  ]);
  const filtered = Boolean(params.q || filters.leadType || filters.purpose);

  return (
    <>
      <PageHeader
        title="Leads pool"
        description={
          viewer.isManager
            ? "Numbers waiting for an agent. Agents see them masked and ask for them; you approve, and the lead lands on their Leads page."
            : `Numbers from the management. Press “Get this lead” — once approved it appears on your Leads page with the full number (up to ${MAX_PENDING_REQUESTS} requests at a time).`
        }
        actions={
          viewer.isManager ? (
            <>
              <PoolBulkButton />
              <AddPoolLeadButton />
            </>
          ) : undefined
        }
      />
      <PendingPoolRequests requests={pending} />
      <MyPoolRequests requests={mine} />
      <PoolToolbar isManager={viewer.isManager} taken={taken} counts={counts} />
      <PoolTable rows={result.items} viewer={viewer} agents={agents} filtered={filtered} taken={taken} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
