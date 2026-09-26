import type { Metadata } from "next";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { tz } from "@date-fns/tz";
import { APP_TIMEZONE, parseZonedInput, zonedMonthStart } from "@/lib/format";
import { ViewingStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { dateParam, enumParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { VIEWING_SORTS, listViewings, viewingsBetween } from "@/services/viewings";
import { listAssignableUsers } from "@/services/users";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { ViewingsCalendar } from "@/components/viewings/viewings-calendar";
import { ViewingsTable } from "@/components/viewings/viewings-table";
import { ViewingsToolbar } from "@/components/viewings/viewings-toolbar";
import { CreateViewingButton } from "@/components/viewings/create-viewing-button";

export const metadata: Metadata = { title: "Viewings" };

const inTz = { in: tz(APP_TIMEZONE) };

function parseMonth(raw: string | undefined) {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const d = parseZonedInput(`${raw}-01`);
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  }
  return zonedMonthStart();
}

export default async function ViewingsPage({ searchParams }: PageProps<"/viewings">) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = param(sp, "view") === "list" ? "list" : "calendar";
  const viewer = toViewer(user);
  const agents = await listAssignableUsers();
  const filters = {
    status: enumParam(sp, "status", ViewingStatus),
    agentId: param(sp, "agent"),
  };
  const header = <PageHeader title="Viewings" description="Property viewings across the team" actions={<CreateViewingButton agents={agents} viewer={viewer} openFromUrl />} />;

  if (view === "calendar") {
    const month = parseMonth(param(sp, "month"));
    const viewings = await viewingsBetween(user, startOfWeek(startOfMonth(month, inTz), inTz), endOfWeek(endOfMonth(month, inTz), inTz), filters);
    return (
      <>
        {header}
        <ViewingsToolbar agents={agents} viewer={viewer} view="calendar" />
        <ViewingsCalendar month={month} viewings={viewings} agents={agents} viewer={viewer} />
      </>
    );
  }

  const upcoming = param(sp, "when") === "upcoming";
  const params = listParams(sp, VIEWING_SORTS, { sort: "startsAt", dir: upcoming ? "asc" : "desc" });
  const result = await listViewings(user, params, { ...filters, from: dateParam(sp, "from"), to: dateParam(sp, "to"), upcoming });
  return (
    <>
      {header}
      <ViewingsToolbar agents={agents} viewer={viewer} view="list" />
      <ViewingsTable rows={result.items} agents={agents} viewer={viewer} filtered={Boolean(params.q || filters.status || filters.agentId || upcoming)} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
