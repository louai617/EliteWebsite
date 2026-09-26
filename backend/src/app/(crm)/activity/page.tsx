import type { Metadata } from "next";
import { EntityType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { dateParam, enumParam, intParam, param } from "@/lib/list-params";
import { can } from "@/lib/permissions";
import { PAGE_SIZES } from "@/lib/constants";
import { listActivities } from "@/services/activity";
import { listAssignableUsers } from "@/services/users";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { ClearFilters, DateRangeFilter, FilterSelect, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";
import { ActivityTimeline } from "@/components/shared/activity-timeline";

export const metadata: Metadata = { title: "Activity" };

const ENTITY_LABELS: Record<EntityType, string> = {
  LEAD: "Leads",
  CLIENT: "Clients",
  OWNER: "Owners",
  PROPERTY: "Properties",
  DEAL: "Deals",
  VIEWING: "Viewings",
  TASK: "Tasks",
  USER: "Team",
};

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = intParam(sp, "page", { min: 1 }) ?? 1;
  const requested = intParam(sp, "size");
  const size = requested && (PAGE_SIZES as readonly number[]).includes(requested) ? requested : 50;
  const to = dateParam(sp, "to");
  const [result, agents] = await Promise.all([
    listActivities(
      user,
      {
        entityType: enumParam(sp, "entity", EntityType),
        userId: can.viewAllActivity(user) ? param(sp, "user") : undefined,
        from: dateParam(sp, "from"),
        to: to ? new Date(to.getTime() + 86_400_000) : undefined,
        q: param(sp, "q"),
      },
      page,
      size,
    ),
    listAssignableUsers(),
  ]);

  return (
    <>
      <PageHeader title="Activity" description={can.viewAllActivity(user) ? "Everything that happened across the CRM" : "Activity on your records"} />
      <Toolbar>
        <SearchInput placeholder="Search activity…" />
        <FilterSelect param="entity" label="Type" options={(Object.keys(ENTITY_LABELS) as EntityType[]).map((e) => ({ value: e, label: ENTITY_LABELS[e] }))} />
        {can.viewAllActivity(user) && <FilterSelect param="user" label="By" options={agents.map((a) => ({ value: a.id, label: a.name }))} />}
        <DateRangeFilter />
        <ClearFilters params={["q", "entity", "user", "from", "to"]} />
      </Toolbar>
      <Card>
        <CardContent className="pt-5">
          <ActivityTimeline items={result.items} showEntity emptyText="No activity matches these filters." />
        </CardContent>
      </Card>
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
