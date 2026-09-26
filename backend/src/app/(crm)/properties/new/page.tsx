import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { toViewer } from "@/lib/viewer";
import { param } from "@/lib/list-params";
import { listAssignableUsers } from "@/services/users";
import { propertyAreas } from "@/services/properties";
import { lookupLabel } from "@/services/search";
import { PageHeader } from "@/components/shared/page-header";
import { PropertyForm } from "@/components/properties/property-form";

export const metadata: Metadata = { title: "New property" };

export default async function NewPropertyPage({ searchParams }: PageProps<"/properties/new">) {
  const user = await requireUser();
  const sp = await searchParams;
  const ownerId = param(sp, "owner");
  const [agents, areas, ownerOption] = await Promise.all([
    listAssignableUsers(),
    propertyAreas(),
    ownerId ? lookupLabel(user, "owner", ownerId) : Promise.resolve(null),
  ]);
  return (
    <>
      <PageHeader
        title="New property"
        description="A reference number (ELT-####) is assigned automatically."
        breadcrumbs={[{ label: "Properties", href: "/properties" }, { label: "New property" }]}
      />
      <PropertyForm agents={agents} viewer={toViewer(user)} areas={areas} ownerOption={ownerOption} defaults={ownerOption ? { ownerId: ownerOption.id } : undefined} />
    </>
  );
}
