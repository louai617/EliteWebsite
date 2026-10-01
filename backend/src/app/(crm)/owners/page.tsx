import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listParams, param } from "@/lib/list-params";
import { OWNER_SORTS, listOwners, ownerNationalities } from "@/services/owners";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";
import { OwnersTable } from "@/components/owners/owners-table";
import { CreateOwnerButton } from "@/components/owners/owner-form";

export const metadata: Metadata = { title: "Owners" };

export default async function OwnersPage({ searchParams }: PageProps<"/owners">) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = listParams(sp, OWNER_SORTS, { sort: "fullName", dir: "asc" });
  const filters = { nationality: param(sp, "nationality") };
  const [result, nationalities] = await Promise.all([listOwners(user, params, filters), ownerNationalities(user)]);
  const filtered = Boolean(params.q || filters.nationality);

  return (
    <>
      <PageHeader title="Owners" description={`${result.total} landlords and sellers`} actions={<CreateOwnerButton openFromUrl />} />
      <Toolbar>
        <SearchInput placeholder="Search name, phone, e-mail…" />
        <FilterSelect param="nationality" label="Nationality" options={nationalities.map((n) => ({ value: n, label: n }))} />
        <ClearFilters params={["q", "nationality"]} />
      </Toolbar>
      <OwnersTable rows={result.items} filtered={filtered} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
