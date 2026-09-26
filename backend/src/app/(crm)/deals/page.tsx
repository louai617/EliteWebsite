import type { Metadata } from "next";
import { DealStatus, DealType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { DEAL_STATUS_META, DEAL_TYPE_META, options } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { dateParam, enumParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { DEAL_SORTS, listDeals } from "@/services/deals";
import { listAssignableUsers } from "@/services/users";
import { getSettings } from "@/services/settings";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { ClearFilters, DateRangeFilter, FilterSelect, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";
import { DealsTable } from "@/components/deals/deals-table";
import { CreateDealButton } from "@/components/deals/create-deal-button";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage({ searchParams }: PageProps<"/deals">) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = listParams(sp, DEAL_SORTS, { sort: "createdAt" });
  const statusParam = param(sp, "status");
  const filters = {
    status: enumParam(sp, "status", DealStatus),
    open: statusParam === "open",
    type: enumParam(sp, "type", DealType),
    agentId: param(sp, "agent"),
    from: dateParam(sp, "from"),
    to: dateParam(sp, "to"),
  };
  const viewer = toViewer(user);
  const [result, agents, settings] = await Promise.all([listDeals(user, params, filters), listAssignableUsers(), getSettings()]);
  const filtered = Boolean(params.q || filters.status || filters.open || filters.type || filters.agentId || filters.from || filters.to);

  return (
    <>
      <PageHeader
        title="Deals"
        description={
          <span className="tabular">
            {result.total} deals · {formatMoney(result.totals.amount)} total value · {formatMoney(result.totals.commission)} commission
          </span>
        }
        actions={<CreateDealButton agents={agents} viewer={viewer} defaults={settings} openFromUrl />}
      />
      <Toolbar>
        <SearchInput placeholder="Search ref, client, property…" />
        <FilterSelect param="status" label="Status" options={[{ value: "open", label: "All open deals" }, ...options(DEAL_STATUS_META)]} />
        <FilterSelect param="type" label="Type" options={options(DEAL_TYPE_META)} />
        {viewer.isManager && <FilterSelect param="agent" label="Agent" options={agents.map((a) => ({ value: a.id, label: a.name }))} />}
        <DateRangeFilter label="Created" />
        <ClearFilters params={["q", "status", "type", "agent", "from", "to"]} />
      </Toolbar>
      <DealsTable rows={result.items} filtered={filtered} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
