import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getTemplate } from "@/services/contracts";
import { PageHeader } from "@/components/shared/page-header";
import { TemplateEditor } from "@/components/contracts/template-editor";

export const metadata: Metadata = { title: "Contract template" };

const BLANK = {
  name: "",
  description: "",
  dealType: null,
  isActive: true,
  fields: [],
  body: "# Agreement title\n\n**Reference:** {{deal_reference}}\n**Date:** {{today}}\n\n## 1. Parties\n\n{{owner_name}} and {{client_name}} agree as follows.\n",
};

export default async function ContractTemplatePage({ params }: PageProps<"/settings/contracts/[id]">) {
  const user = await requireUser();
  if (!can.editSettings(user)) forbidden();
  const { id } = await params;
  const template = id === "new" ? null : await getTemplate(id);
  if (id !== "new" && !template) notFound();
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Contract templates", href: "/settings/contracts" }, { label: template?.name ?? "New template" }]}
        title={template?.name ?? "New template"}
        description={template ? `Version ${template.version}. Editing creates a new version; contracts already generated keep their text.` : "Write the contract once; agents generate it from a deal."}
      />
      <TemplateEditor
        template={
          template
            ? { id: template.id, name: template.name, description: template.description ?? "", dealType: template.dealType, isActive: template.isActive, fields: template.fields, body: template.body }
            : BLANK
        }
      />
    </>
  );
}
