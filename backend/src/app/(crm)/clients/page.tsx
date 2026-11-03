import type { Metadata } from "next";
import { CustomerType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { CUSTOMER_TYPE_META, options } from "@/lib/constants";
import { enumParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { CLIENT_SORTS, listClients } from "@/services/clients";
import { listAssignableUsers } from "@/services/users";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";
import { ClientsTable } from "@/components/clients/clients-table";
import { CreateClientButton } from "@/components/clients/client-form";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = listParams(sp, CLIENT_SORTS, { sort: "createdAt" });
  const filters = { clientType: enumParam(sp, "type", CustomerType), agentId: param(sp, "agent") };
  const viewer = toViewer(user);
  const [result, agents] = await Promise.all([listClients(user, params, filters), listAssignableUsers()]);

  return (
    <>
      <PageHeader title="Clients" description={`${result.total} buyers, tenants, investors, landlords and sellers`} actions={<CreateClientButton agents={agents} viewer={viewer} openFromUrl />} />
      <Toolbar>
        <SearchInput placeholder="Search name, phone, QID…" />
        <FilterSelect param="type" label="Type" options={options(CUSTOMER_TYPE_META)} />
        {viewer.isManager && <FilterSelect param="agent" label="Agent" options={[{ value: "none", label: "Unassigned" }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />}
        <ClearFilters params={["q", "type", "agent"]} />
      </Toolbar>
      <ClientsTable rows={result.items} filtered={Boolean(params.q || filters.clientType || filters.agentId)} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
