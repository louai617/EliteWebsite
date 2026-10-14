import type { Metadata } from "next";
import { PROPERTY_TYPE_META } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { toViewer } from "@/lib/viewer";
import { CLIENT_DOCUMENT_KINDS, CUSTOMER_TYPE_META, LEAD_SOURCE_META, LEAD_STATUS_META, RESERVATION_STATUS_META } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { getClient } from "@/services/clients";
import { listNotes } from "@/services/notes";
import { timeline } from "@/services/activity";
import { listAssignableUsers } from "@/services/users";
import { getSettings } from "@/services/settings";
import { listTasks } from "@/services/tasks";
import { addClientInterestAction, removeClientInterestAction } from "@/actions/clients";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { InfoList } from "@/components/shared/info-list";
import { NotesPanel } from "@/components/shared/notes-panel";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { AgentCell } from "@/components/shared/user-avatar";
import { RecordActions } from "@/components/shared/record-actions";
import { LogActivityButton } from "@/components/activities/log-activity";
import { PortalAccessCard } from "@/components/clients/portal-access";
import { portalAccessFor } from "@/services/client-accounts";
import { hasPermission } from "@/lib/permissions";
import { CLIENT_APP_URL } from "@/lib/env";
import { InterestList } from "@/components/shared/interest-list";
import { DealMiniList, ViewingMiniList } from "@/components/shared/related-lists";
import { ClientHeaderActions } from "@/components/clients/client-header-actions";
import { TaskList } from "@/components/tasks/task-list";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { listDocuments } from "@/services/documents";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(user, id);
  if (!client) notFound();
  const viewer = toViewer(user);
  const [notes, activity, agents, settings, tasks, portalAccount, documents, reservations] = await Promise.all([
    listNotes("client", id),
    timeline("clientId", id, 40),
    listAssignableUsers(),
    getSettings(),
    listTasks(user, { page: 1, pageSize: 50, sort: "dueDate", dir: "asc" }, { clientId: id }),
    portalAccessFor(id),
    listDocuments(user, "client", id),
    db.reservation.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, reference: true, status: true, amount: true, currency: true, createdAt: true, property: { select: { reference: true, title: true } } } }),
  ]);
  const idKinds = new Set(documents.map((d) => d.kind));
  const missingId = !idKinds.has("QID") && !idKinds.has("PASSPORT");
  const clientOption = { id: client.id, label: client.fullName };
  const listOf = (json: string | null): string[] => {
    try {
      const v = json ? JSON.parse(json) : [];
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  };
  const priceDrops = client.interests.filter((i) => i.priceAtSave && i.property.price < i.priceAtSave).length;
  const firstProperty = client.interests[0]?.property;
  const propertyOption = firstProperty ? { id: firstProperty.id, label: `${firstProperty.reference} · ${firstProperty.title}` } : null;
  const wonValue = client.deals.filter((d) => d.status === "CLOSED").reduce((sum, d) => sum + d.amount, 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: client.fullName }]}
        title={client.fullName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Badge tone="neutral">{CUSTOMER_TYPE_META[client.clientType].label}</Badge>
            <span>Client since {formatDate(client.createdAt)}</span>
            <span className="flex items-center gap-1.5">· <AgentCell agent={client.agent} /></span>
          </span>
        }
        actions={<ClientHeaderActions client={client} agents={agents} viewer={viewer} />}
      >
        <div className="flex flex-wrap gap-2">
          <RecordActions
            agents={agents}
            viewer={viewer}
            viewing={{ clientId: client.id, clientOption, propertyId: firstProperty?.id, propertyOption, agentId: client.agentId }}
            task={{ clientId: client.id, clientOption }}
            deal={
              viewer.isManager
                ? {
              clientId: client.id,
              clientOption,
              propertyId: firstProperty?.id,
              propertyOption,
              type: firstProperty?.purpose === "SALE" ? "SALE" : "RENTAL",
              amount: firstProperty ? (firstProperty.purpose === "SALE" ? firstProperty.price : firstProperty.price * 12) : undefined,
              defaults: settings,
            }
                : undefined
            }
          />
          <LogActivityButton viewer={viewer} agents={agents} label="Log follow-up" prefill={{ type: "CLIENT_FOLLOW_UP", clientId: client.id, clientOption }} />
        </div>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoList
                  columns={1}
                  items={[
                    { label: "Phone", value: <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="size-3.5 text-muted-foreground" />{client.phone}</a> },
                    { label: "E-mail", value: client.email && <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="size-3.5 text-muted-foreground" />{client.email}</a> },
                    { label: "Nationality", value: client.nationality },
                    { label: "QID / passport", value: client.idReference },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoList
                  items={[
                    { label: "Budget", value: client.budgetMax != null ? `${client.budgetMin != null ? formatMoney(client.budgetMin) : "Any"} – ${formatMoney(client.budgetMax)}` : null },
                    { label: "Closed business", value: wonValue ? formatMoney(wonValue) : null },
                  ]}
                />
                {client.requirements && <p className="text-sm whitespace-pre-wrap">{client.requirements}</p>}
                {client.notes && <p className="rounded-md bg-muted/60 p-3 text-sm whitespace-pre-wrap">{client.notes}</p>}
              </CardContent>
            </Card>
          </div>

          <Card id="documents">
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              {missingId && <Badge tone="amber">QID / passport missing</Badge>}
            </CardHeader>
            <CardContent>
              <DocumentsPanel
                target="client"
                targetId={client.id}
                documents={documents}
                kinds={CLIENT_DOCUMENT_KINDS}
                canDelete={viewer.isManager}
                emptyText="Upload the client's QID, passport and signed contract. Documents from their lead and deals appear here too."
              />
            </CardContent>
          </Card>

          {reservations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reservations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {reservations.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <Link href={`/reservations?q=${r.reference}`} className="font-mono text-xs hover:underline">
                        {r.reference}
                      </Link>
                      <span className="min-w-0 flex-1 truncate">
                        {r.property.reference} · {r.property.title}
                      </span>
                      <span className="tabular">{formatMoney(r.amount, r.currency)}</span>
                      <EnumBadge meta={RESERVATION_STATUS_META} value={r.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Shortlisted properties</CardTitle>
            </CardHeader>
            <CardContent>
              <InterestList ownerKey="clientId" ownerId={client.id} properties={client.interests.map((i) => i.property)} add={addClientInterestAction} remove={removeClientInterestAction} />
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Viewings</CardTitle>
              </CardHeader>
              <CardContent>
                <ViewingMiniList viewings={client.viewings} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Deals</CardTitle>
              </CardHeader>
              <CardContent>
                <DealMiniList deals={client.deals} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <div className="border-t">
              <TaskList tasks={tasks.items} agents={agents} viewer={viewer} compact emptyTitle="No tasks for this client" />
            </div>
          </Card>

          {client.leads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Source leads</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {client.leads.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <Link href={`/leads/${l.id}`} className="text-sm hover:underline">{l.fullName}</Link>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {LEAD_SOURCE_META[l.source].label} · {formatDate(l.createdAt)} <EnumBadge meta={LEAD_STATUS_META} value={l.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Website preferences</CardTitle>
              <span className="text-xs text-muted-foreground">Set by the client on eliterealestate.qa</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoList
                columns={1}
                items={[
                  { label: "Looking to", value: client.preferredPurpose ? (client.preferredPurpose === "RENT" ? "Rent" : "Buy") : null },
                  { label: "Property types", value: listOf(client.preferredTypes).map((t) => PROPERTY_TYPE_META[t as keyof typeof PROPERTY_TYPE_META]?.label ?? t).join(", ") || null },
                  { label: "Areas", value: listOf(client.preferredAreas).join(", ") || null },
                  { label: "Bedrooms", value: client.preferredBedrooms == null ? null : client.preferredBedrooms === 0 ? "Studio+" : `${client.preferredBedrooms}+` },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                {client.interests.length} saved home{client.interests.length === 1 ? "" : "s"}
                {priceDrops > 0 ? ` · ${priceDrops} with a price drop since saved` : ""} · {client.viewings.filter((v) => v.bookedByClient).length} booked online
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Client portal</CardTitle>
            </CardHeader>
            <CardContent>
              <PortalAccessCard clientId={client.id} defaultEmail={client.email} account={portalAccount} portalUrl={CLIENT_APP_URL} canManage={hasPermission(user, "clients.managePortal")} />
            </CardContent>
          </Card>
          <NotesPanel target="client" targetId={client.id} notes={notes} currentUserId={user.id} isManager={viewer.isManager} />
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
