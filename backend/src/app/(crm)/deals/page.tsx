import type { Metadata } from "next";
import Link from "next/link";
import { DealStatus, DealType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { DEAL_TYPE_META, options } from "@/lib/constants";
import { cn } from "@/lib/utils";
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

export const metadata: Metadata = { title: "Pending contracts" };

/** Pending contracts by default; closed (now clients) and cancelled deals stay reachable as history. */
const VIEWS = [
  { value: undefined, status: "PENDING_CONTRACT", label: "Pending contracts" },
  { value: "closed", status: "CLOSED", label: "Closed (clients)" },
  { value: "cancelled", status: "CANCELLED", label: "Cancelled" },
] as const;

export default async function DealsPage({ searchParams }: PageProps<"/deals">) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = listParams(sp, DEAL_SORTS, { sort: "createdAt" });
  const view = VIEWS.find((v) => v.value && v.value === param(sp, "view")) ?? VIEWS[0];
  const filters = {
    status: view.status as DealStatus,
    type: enumParam(sp, "type", DealType),
    agentId: param(sp, "agent"),
    from: dateParam(sp, "from"),
    to: dateParam(sp, "to"),
  };
  const viewer = toViewer(user);
  const [result, agents, settings] = await Promise.all([listDeals(user, params, filters), listAssignableUsers(), getSettings()]);
  const filtered = Boolean(params.q || filters.type || filters.agentId || filters.from || filters.to);
  const pending = view.status === "PENDING_CONTRACT";

  return (
    <>
      <PageHeader
        title="Pending contracts"
        description={
          <span className="tabular">
            {pending
              ? `${result.total} booked ${result.total === 1 ? "deal" : "deals"} waiting for the contract · ${formatMoney(result.totals.amount)} · ${formatMoney(result.totals.commission)} commission. Closing one turns the buyer or tenant into a client.`
              : `${result.total} ${view.label.toLowerCase()} · ${formatMoney(result.totals.amount)} · ${formatMoney(result.totals.commission)} commission`}
          </span>
        }
        actions={viewer.isManager ? <CreateDealButton agents={agents} viewer={viewer} defaults={settings} openFromUrl /> : undefined}
      />
      <Toolbar>
        <SearchInput placeholder="Search ref, client, property…" />
        <FilterSelect param="type" label="Type" options={options(DEAL_TYPE_META)} />
        {viewer.isManager && <FilterSelect param="agent" label="Agent" options={agents.map((a) => ({ value: a.id, label: a.name }))} />}
        <DateRangeFilter label="Created" />
        <ClearFilters params={["q", "type", "agent", "from", "to"]} keep={["view"]} />
        <div className="ml-auto flex rounded-md border bg-card p-0.5 shadow-xs" role="group" aria-label="Show">
          {VIEWS.map((v) => (
            <Link
              key={v.label}
              href={v.value ? `/deals?view=${v.value}` : "/deals"}
              aria-current={v === view ? "page" : undefined}
              className={cn("flex h-7 items-center rounded px-2 text-xs text-muted-foreground", v === view && "bg-secondary text-foreground")}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </Toolbar>
      <DealsTable rows={result.items} filtered={filtered} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
