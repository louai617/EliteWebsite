import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, XCircle } from "lucide-react";
import type { DealStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { toViewer } from "@/lib/viewer";
import { CLIENT_DOCUMENT_KINDS, CUSTOMER_TYPE_META, DEAL_STATUS_META, DEAL_TYPE_META, LEAD_STATUS_META, PROPERTY_STATUS_META } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDeal } from "@/services/deals";
import { listNotes } from "@/services/notes";
import { timeline } from "@/services/activity";
import { listAssignableUsers } from "@/services/users";
import { getSettings } from "@/services/settings";
import { listTasks } from "@/services/tasks";
import { listDocuments } from "@/services/documents";
import { autoValues, listTemplates } from "@/services/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { InfoList } from "@/components/shared/info-list";
import { NotesPanel } from "@/components/shared/notes-panel";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { AgentCell } from "@/components/shared/user-avatar";
import { PropertyImage } from "@/components/shared/property-image";
import { RecordActions } from "@/components/shared/record-actions";
import { DealHeaderActions } from "@/components/deals/deal-header-actions";
import { TaskList } from "@/components/tasks/task-list";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { ContractsPanel } from "@/components/contracts/contracts-panel";

export const metadata: Metadata = { title: "Deal" };

const STEPS: { status: DealStatus; label: string }[] = [
  { status: "PENDING_CONTRACT", label: "Won · pending contract" },
  { status: "CLOSED", label: "Closed · client" },
];

function StatusSteps({ status, reason }: { status: DealStatus; reason: string | null }) {
  if (status === "CANCELLED") {
    return (
      <p className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        <XCircle className="mt-0.5 size-4 shrink-0" />
        <span>
          This deal was cancelled{reason ? `: ${reason}` : "."}
        </span>
      </p>
    );
  }
  return (
    <ol className="grid grid-cols-2 gap-1.5" aria-label="Deal progress">
      {STEPS.map((step, i) => {
        const done = status === "CLOSED" || i === 0;
        const active = step.status === status && status !== "CLOSED";
        return (
          <li key={step.status} className="min-w-0">
            <div className={cn("h-1.5 rounded-full bg-border", done && !active && "bg-emerald-500", active && "bg-gold")} />
            <p className={cn("mt-1.5 flex items-center gap-1 truncate text-xs text-muted-foreground", (done || active) && "font-medium text-foreground")}>
              {done && !active && <Check className="size-3 text-emerald-600" />}
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export default async function DealPage({ params }: PageProps<"/deals/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const deal = await getDeal(user, id);
  if (!deal) notFound();
  const viewer = toViewer(user);
  const [notes, activity, agents, settings, tasks, documents, templates, filled] = await Promise.all([
    listNotes("deal", id),
    timeline("dealId", id, 40),
    listAssignableUsers(),
    getSettings(),
    listTasks(user, { page: 1, pageSize: 50, sort: "dueDate", dir: "asc" }, { dealId: id }).then((r) => r.items),
    listDocuments(user, "deal", id),
    listTemplates({ activeOnly: true }),
    autoValues(user, id),
  ]);
  const party = deal.client ?? deal.lead;
  const templateOptions = templates
    .filter((t) => !t.dealType || t.dealType === deal.type)
    .map((t) => ({ id: t.id, name: t.name, description: t.description, body: t.body, fields: t.fields }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Deals", href: "/deals" }, { label: deal.reference }]}
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono">{deal.reference}</span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate">{party?.fullName ?? "—"}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <EnumBadge meta={DEAL_STATUS_META} value={deal.status} dot />
            <EnumBadge meta={DEAL_TYPE_META} value={deal.type} />
            <span>Opened {formatDate(deal.createdAt)}</span>
            {deal.closedAt && <span>Closed {formatDate(deal.closedAt)}</span>}
          </span>
        }
        actions={<DealHeaderActions deal={deal} defaults={settings} agents={agents} viewer={viewer} />}
      >
        <div className="flex flex-wrap gap-2">
          <RecordActions
            agents={agents}
            viewer={viewer}
            task={{ dealId: deal.id, dealOption: { id: deal.id, label: deal.reference }, clientId: deal.clientId ?? undefined, clientOption: deal.client ? { id: deal.client.id, label: deal.client.fullName } : null }}
          />
        </div>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardContent className="space-y-5 pt-5">
              <StatusSteps status={deal.status} reason={deal.cancelReason} />
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: deal.type === "RENTAL" ? "Contract value" : "Sale price", value: formatMoney(deal.amount), strong: true },
                  { label: `Commission (${deal.commissionPercent}%)`, value: formatMoney(deal.commissionAmount), strong: true },
                  { label: `Agent (${deal.agentSharePercent}%)`, value: formatMoney(deal.agentCommission) },
                  { label: "Company", value: formatMoney(deal.companyCommission) },
                ].map((s) => (
                  <div key={s.label} className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={cn("tabular mt-1 text-lg", s.strong ? "font-semibold" : "font-medium")}>{s.value}</p>
                  </div>
                ))}
              </div>
              <InfoList
                columns={3}
                items={[
                  { label: "Contract date", value: formatDate(deal.contractDate) },
                  { label: "Closing date", value: formatDate(deal.closingDate) },
                  { label: "Agent", value: <AgentCell agent={deal.agent} /> },
                ]}
              />
              {deal.notes && <p className="rounded-md bg-muted/60 p-3 text-sm whitespace-pre-wrap">{deal.notes}</p>}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Property</CardTitle>
                <EnumBadge meta={PROPERTY_STATUS_META} value={deal.property.status} />
              </CardHeader>
              <CardContent>
                <Link href={`/properties/${deal.property.id}`} className="flex items-center gap-3 hover:underline">
                  <PropertyImage src={deal.property.images[0]?.thumbUrl ?? deal.property.images[0]?.url} alt="" className="h-14 w-20 shrink-0 rounded-md" />
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-medium">{deal.property.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {deal.property.reference} · {deal.property.area} · {formatMoney(deal.property.price, deal.property.currency)}
                    </span>
                  </span>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Parties</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoList
                  columns={1}
                  items={[
                    deal.client
                      ? { label: `Client · ${CUSTOMER_TYPE_META[deal.client.clientType].label}`, value: <Link href={`/clients/${deal.client.id}`} className="hover:underline">{deal.client.fullName} · {deal.client.phone}</Link> }
                      : { label: "Client", value: <span className="text-muted-foreground">Created from the lead when the deal closes</span> },
                    { label: "Owner", value: deal.owner && <Link href={`/owners/${deal.owner.id}`} className="hover:underline">{deal.owner.fullName} · {deal.owner.phone}</Link> },
                    { label: "Originating lead", value: deal.lead && <span className="flex items-center gap-2"><Link href={`/leads/${deal.lead.id}`} className="hover:underline">{deal.lead.fullName}</Link><EnumBadge meta={LEAD_STATUS_META} value={deal.lead.status} /></span> },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contracts</CardTitle>
              </CardHeader>
              <CardContent>
                <ContractsPanel
                  dealId={deal.id}
                  contracts={deal.contracts}
                  templates={templateOptions}
                  autoValues={filled.values}
                  canGenerate={deal.status !== "CANCELLED"}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentsPanel
                  target="deal"
                  targetId={deal.id}
                  documents={documents}
                  kinds={["CONTRACT", ...CLIENT_DOCUMENT_KINDS.filter((k) => k !== "CONTRACT")]}
                  canDelete={viewer.isManager}
                  emptyText="The booking form and payment proof appear here when the lead is won."
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <div className="border-t">
              <TaskList tasks={tasks} agents={agents} viewer={viewer} compact emptyTitle="No tasks for this deal" />
            </div>
          </Card>
        </div>
        <aside className="space-y-5">
          <NotesPanel target="deal" targetId={deal.id} notes={notes} currentUserId={user.id} isManager={viewer.isManager} />
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={activity} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
