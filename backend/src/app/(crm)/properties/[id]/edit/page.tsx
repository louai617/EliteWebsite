import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/auth/session";
import { toViewer } from "@/lib/viewer";
import { listAssignableUsers } from "@/services/users";
import { getPropertyForEdit, propertyAreas } from "@/services/properties";
import { PageHeader } from "@/components/shared/page-header";
import { PropertyForm } from "@/components/properties/property-form";

export const metadata: Metadata = { title: "Edit property" };

export default async function EditPropertyPage({ params }: PageProps<"/properties/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const property = await getPropertyForEdit(user, id).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "FORBIDDEN") forbidden();
    throw error;
  });
  if (!property) notFound();
  const [agents, areas] = await Promise.all([listAssignableUsers(), propertyAreas()]);
  const { owner, ...values } = property;

  return (
    <>
      <PageHeader
        title={`Edit ${property.reference}`}
        description={property.title}
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          { label: property.reference, href: `/properties/${id}` },
          { label: "Edit" },
        ]}
      />
      <PropertyForm
        propertyId={id}
        defaults={values}
        ownerOption={owner ? { id: owner.id, label: owner.fullName, hint: owner.phone } : null}
        agents={agents}
        viewer={toViewer(user)}
        areas={areas}
      />
    </>
  );
}
