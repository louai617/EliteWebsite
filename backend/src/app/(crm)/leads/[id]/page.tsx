import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { toViewer } from "@/lib/viewer";
import { CUSTOMER_TYPE_META, FURNISHING_META, LEAD_SOURCE_META, LEAD_STATUS_META, PRIORITY_META, PURPOSE_META } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { RelativeTime } from "@/components/shared/relative-time";
import { getLead } from "@/services/leads";
import { listNotes } from "@/services/notes";
import { timeline } from "@/services/activity";
import { listAssignableUsers } from "@/services/users";
import { getSettings } from "@/services/settings";
import { listTasks } from "@/services/tasks";
import { addLeadInterestAction, removeLeadInterestAction } from "@/actions/leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { InfoList } from "@/components/shared/info-list";
import { NotesPanel } from "@/components/shared/notes-panel";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { AgentCell } from "@/components/shared/user-avatar";
import { RecordActions } from "@/components/shared/record-actions";
import { InterestList } from "@/components/shared/interest-list";
import { DealMiniList, ViewingMiniList } from "@/components/shared/related-lists";
import { LeadHeaderActions } from "@/components/leads/lead-header-actions";
import { TaskList } from "@/components/tasks/task-list";
import { LogActivityButton } from "@/components/activities/log-activity";

export const metadata: Metadata = { title: "Lead" };

function whatsapp(phone: string) {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await getLead(user, id);
  if (!lead) notFound();
  const viewer = toViewer(user);
  const [notes, activity, agents, settings, tasks] = await Promise.all([
    listNotes("lead", id),
    timeline("leadId", id, 40),
    listAssignableUsers(),
    getSettings(),
    listTasks(user, { page: 1, pageSize: 50, sort: "dueDate", dir: "asc" }, { leadId: id }),
  ]);

  const firstProperty = lead.interests[0]?.property;
  const propertyOption = firstProperty ? { id: firstProperty.id, label: `${firstProperty.reference} · ${firstProperty.title}` } : null;
  const leadOption = { id: lead.id, label: lead.fullName };
  const clientOption = lead.client ? { id: lead.client.id, label: lead.client.fullName } : null;

  const budget =
    lead.budgetMin != null || lead.budgetMax != null
      ? `${lead.budgetMin != null ? formatMoney(lead.budgetMin) : "Any"} – ${lead.budgetMax != null ? formatMoney(lead.budgetMax) : "Any"}${lead.purpose === "RENT" ? " / month" : ""}`
      : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: lead.fullName }]}
        title={lead.fullName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <EnumBadge meta={LEAD_STATUS_META} value={lead.status} dot />
            <EnumBadge meta={PRIORITY_META} value={lead.priority} />
            <span>{LEAD_SOURCE_META[lead.source].label}</span>
            <span>Created <RelativeTime date={lead.createdAt} /></span>
            <span className="flex items-center gap-1.5">
              · <AgentCell agent={lead.agent} />
            </span>
          </span>
        }
        actions={<LeadHeaderActions lead={lead} clientId={lead.clientId} agents={agents} viewer={viewer} />}
      >
        <div className="flex flex-wrap gap-2">
          <RecordActions
            agents={agents}
            viewer={viewer}
            viewing={{ leadId: lead.id, leadOption, clientId: lead.clientId ?? undefined, clientOption, propertyId: firstProperty?.id, propertyOption, agentId: lead.agentId }}
            task={{ leadId: lead.id, leadOption }}
            deal={{
              leadId: lead.id,
              leadOption,
              clientId: lead.clientId ?? undefined,
              clientOption,
              propertyId: firstProperty?.id,
              propertyOption,
              type: firstProperty?.purpose === "SALE" ? "SALE" : "RENTAL",
              amount: firstProperty ? (firstProperty.purpose === "SALE" ? firstProperty.price : firstProperty.price * 12) : undefined,
              defaults: settings,
            }}
          />
          <LogActivityButton
            viewer={viewer}
            agents={agents}
            label={lead.status === "NEW" ? "Log first response" : "Log call / follow-up"}
            prefill={{ type: lead.status === "NEW" ? "LEAD_RESPONSE" : "FOLLOW_UP", leadId: lead.id, leadOption, clientId: lead.clientId ?? undefined, clientOption }}
          />
        </div>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoList
                  columns={1}
                  items={[
                    { label: "Phone", value: <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="size-3.5 text-muted-foreground" />{lead.phone}</a> },
                    { label: "E-mail", value: lead.email && <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="size-3.5 text-muted-foreground" />{lead.email}</a> },
                    { label: "Nationality", value: lead.nationality },
                    { label: "Client profile", value: lead.client && <Link href={`/clients/${lead.client.id}`} className="hover:underline">{lead.client.fullName} · {CUSTOMER_TYPE_META[lead.client.clientType].label}</Link> },
                  ]}
                />
                <a href={whatsapp(lead.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline">
                  <MessageCircle className="size-3.5" /> Open WhatsApp chat
                </a>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoList
                  columns={2}
                  items={[
                    { label: "Purpose", value: lead.purpose && <EnumBadge meta={PURPOSE_META} value={lead.purpose} /> },
                    { label: "Type", value: lead.leadType && CUSTOMER_TYPE_META[lead.leadType].label },
                    { label: "Area", value: lead.interestedArea },
                    { label: "Bedrooms", value: lead.bedrooms === 0 ? "Studio" : lead.bedrooms },
                    { label: "Budget", value: budget },
                    { label: "Furnishing", value: lead.furnishing && FURNISHING_META[lead.furnishing].label },
                  ]}
                />
                {lead.notes && <p className="mt-4 rounded-md bg-muted/60 p-3 text-sm whitespace-pre-wrap">{lead.notes}</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Interested properties</CardTitle>
            </CardHeader>
            <CardContent>
              <InterestList ownerKey="leadId" ownerId={lead.id} properties={lead.interests.map((i) => i.property)} add={addLeadInterestAction} remove={removeLeadInterestAction} />
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Viewings</CardTitle>
              </CardHeader>
              <CardContent>
                <ViewingMiniList viewings={lead.viewings} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Deals</CardTitle>
              </CardHeader>
              <CardContent>
                <DealMiniList deals={lead.deals} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <div className="border-t">
              <TaskList tasks={tasks.items} agents={agents} viewer={viewer} compact emptyTitle="No tasks for this lead" />
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <NotesPanel target="lead" targetId={lead.id} notes={notes} currentUserId={user.id} isManager={viewer.isManager} />
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <span className="text-xs text-muted-foreground">Since {formatDate(lead.createdAt)}</span>
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
