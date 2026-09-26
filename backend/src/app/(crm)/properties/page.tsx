import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Furnishing, ListingPurpose, PropertyStatus, PropertyType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { enumParam, intParam, listParams, param } from "@/lib/list-params";
import { toViewer } from "@/lib/viewer";
import { listAssignableUsers } from "@/services/users";
import { PROPERTY_SORTS, listProperties, propertyAreas } from "@/services/properties";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/data-table/pagination";
import { PropertiesTable, PropertyGrid } from "@/components/properties/properties-table";
import { PropertiesToolbar } from "@/components/properties/properties-toolbar";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = listParams(sp, PROPERTY_SORTS, { sort: "updatedAt" });
  const filters = {
    status: enumParam(sp, "status", PropertyStatus),
    purpose: enumParam(sp, "purpose", ListingPurpose),
    type: enumParam(sp, "type", PropertyType),
    area: param(sp, "area"),
    priceMin: intParam(sp, "priceMin"),
    priceMax: intParam(sp, "priceMax"),
    beds: intParam(sp, "beds", { max: 20 }),
    furnishing: enumParam(sp, "furnishing", Furnishing),
    agentId: param(sp, "agent"),
    featured: param(sp, "featured") === "1",
  };
  const [result, areas, agents] = await Promise.all([listProperties(user, params, filters), propertyAreas(), listAssignableUsers()]);
  const viewer = toViewer(user);
  const filtered = Boolean(params.q) || Object.values(filters).some((v) => v !== undefined && v !== false);
  const grid = param(sp, "view") === "grid";

  return (
    <>
      <PageHeader
        title="Properties"
        description={`${result.total} ${result.total === 1 ? "listing" : "listings"}${filtered ? " match your filters" : " in inventory"}`}
        actions={
          <Button asChild>
            <Link href="/properties/new">
              <Plus /> Add property
            </Link>
          </Button>
        }
      />
      <PropertiesToolbar areas={areas} agents={agents} viewer={viewer} />
      {grid ? <PropertyGrid rows={result.items} filtered={filtered} /> : <PropertiesTable rows={result.items} viewer={viewer} filtered={filtered} />}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
