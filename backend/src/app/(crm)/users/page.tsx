import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { ROLE_META, options } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { enumParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { USER_SORTS, listUsers } from "@/services/users";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";
import { UsersTable } from "@/components/users/users-table";
import { UserSheetButton } from "@/components/users/user-form";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const user = await requireUser();
  if (!can.manageUsers(user)) forbidden();
  const sp = await searchParams;
  const params = listParams(sp, USER_SORTS, { sort: "name", dir: "asc" });
  const active = param(sp, "active");
  const result = await listUsers(user, params, { role: enumParam(sp, "role", Role), active: active === "1" ? true : active === "0" ? false : undefined });
  const viewer = toViewer(user);

  return (
    <>
      <PageHeader
        title="Users"
        description={user.role === "ADMIN" ? "Manage team members, roles and access" : "Manage your agents"}
        actions={<UserSheetButton viewer={viewer} />}
      />
      <Toolbar>
        <SearchInput placeholder="Search name, e-mail…" />
        <FilterSelect param="role" label="Role" options={options(ROLE_META)} />
        <FilterSelect param="active" label="Status" options={[{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }]} />
        <ClearFilters params={["q", "role", "active"]} />
      </Toolbar>
      <UsersTable rows={result.items} viewer={viewer} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
