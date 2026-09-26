import type { Metadata } from "next";
import { LeadSource, LeadStatus, ListingPurpose, Priority } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { dateParam, enumParam, intParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { LEAD_SORTS, leadBoard, listLeads } from "@/services/leads";
import { listAssignableUsers } from "@/services/users";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { LeadBoard } from "@/components/leads/lead-board";
import { LeadsTable } from "@/components/leads/leads-table";
import { LeadsToolbar } from "@/components/leads/leads-toolbar";
import { CreateLeadButton } from "@/components/leads/create-lead-button";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = param(sp, "view") === "table" ? "table" : "board";
  const params = listParams(sp, LEAD_SORTS, { sort: "createdAt" });
  const filters = {
    source: enumParam(sp, "source", LeadSource),
    priority: enumParam(sp, "priority", Priority),
    purpose: enumParam(sp, "purpose", ListingPurpose),
    agentId: param(sp, "agent"),
    from: dateParam(sp, "from"),
    to: dateParam(sp, "to"),
    budgetMin: intParam(sp, "budgetMin"),
    budgetMax: intParam(sp, "budgetMax"),
  };
  const viewer = toViewer(user);
  const agents = await listAssignableUsers();
  const filtered = Boolean(params.q) || Object.values(filters).some((v) => v !== undefined);

  const header = (total: number) => (
    <PageHeader
      title="Leads"
      description={`${total} ${total === 1 ? "lead" : "leads"}${viewer.isManager ? " across the team" : " assigned to you"}`}
      actions={<CreateLeadButton agents={agents} viewer={viewer} openFromUrl />}
    />
  );

  if (view === "board") {
    const columns = await leadBoard(user, params.q, filters);
    return (
      <>
        {header(columns.reduce((sum, c) => sum + c.total, 0))}
        <LeadsToolbar agents={agents} viewer={viewer} view="board" />
        <LeadBoard columns={columns} />
      </>
    );
  }

  const status = enumParam(sp, "status", LeadStatus);
  const result = await listLeads(user, params, { ...filters, status });
  return (
    <>
      {header(result.total)}
      <LeadsToolbar agents={agents} viewer={viewer} view="table" />
      <LeadsTable rows={result.items} filtered={filtered || Boolean(status)} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
