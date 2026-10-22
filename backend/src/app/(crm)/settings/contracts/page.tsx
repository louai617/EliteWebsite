import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { FileSignature, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { DEAL_TYPE_META } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { listTemplates } from "@/services/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";

export const metadata: Metadata = { title: "Contract templates" };

export default async function ContractTemplatesPage() {
  const user = await requireUser();
  if (!can.editSettings(user)) forbidden();
  const templates = await listTemplates();
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Contract templates" }]}
        title="Contract templates"
        description="The drafts agents generate contracts from. Agents only fill in the fields you define; everything else comes from the deal."
        actions={
          <Button asChild>
            <Link href="/settings/contracts/new">
              <Plus /> New template
            </Link>
          </Button>
        }
      />
      <div className="grid max-w-4xl gap-3">
        {templates.map((t) => (
          <Card key={t.id} className="p-0">
            <Link href={`/settings/contracts/${t.id}`} className="flex items-start gap-4 p-4 hover:bg-accent/40">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                <FileSignature className="size-5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{t.name}</h2>
                  {t.dealType ? <EnumBadge meta={DEAL_TYPE_META} value={t.dealType} /> : <Badge tone="neutral">Any deal</Badge>}
                  {!t.isActive && <Badge tone="slate">Off</Badge>}
                </div>
                {t.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.fields.length} field{t.fields.length === 1 ? "" : "s"} for agents · version {t.version} · updated {formatDate(t.updatedAt)}
                  {t.updatedBy ? ` by ${t.updatedBy.name}` : ""} · {t._count.contracts} contract{t._count.contracts === 1 ? "" : "s"} generated
                </p>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </>
  );
}
