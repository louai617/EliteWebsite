import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Handshake, Mail, Phone, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { DEAL_STATUS_META, DEAL_TYPE_META, PROPERTY_STATUS_META, PURPOSE_META } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { getOwner } from "@/services/owners";
import { listNotes } from "@/services/notes";
import { timeline } from "@/services/activity";
import { deleteOwnerAction } from "@/actions/owners";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { InfoList } from "@/components/shared/info-list";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { NotesPanel } from "@/components/shared/notes-panel";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { PropertyImage } from "@/components/shared/property-image";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { EditOwnerButton } from "@/components/owners/owner-form";

export const metadata: Metadata = { title: "Owner" };

export default async function OwnerPage({ params }: PageProps<"/owners/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const owner = await getOwner(user, id);
  if (!owner) notFound();
  const [notes, activity] = await Promise.all([listNotes("owner", id), timeline("ownerId", id)]);
  const active = owner.properties.filter((p) => p.status === "AVAILABLE").length;

  return (
    <>
      <PageHeader
        title={owner.fullName}
        description={`${owner.properties.length} ${owner.properties.length === 1 ? "property" : "properties"} · ${active} active listing${active === 1 ? "" : "s"}`}
        breadcrumbs={[{ label: "Owners", href: "/owners" }, { label: owner.fullName }]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/properties/new?owner=${owner.id}`}>
                <Plus /> Add property
              </Link>
            </Button>
            <EditOwnerButton owner={owner} />
            {can.deleteRecords(user) && (
              <DeleteRecordButton
                action={deleteOwnerAction}
                id={owner.id}
                redirectTo="/owners"
                title={`Delete ${owner.fullName}?`}
                description="Owners who still own properties can't be deleted. Notes on this owner are removed."
              />
            )}
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoList
                items={[
                  { label: "Phone", value: <a className="inline-flex items-center gap-1.5 hover:underline" href={`tel:${owner.phone.replace(/\s/g, "")}`}><Phone className="size-3.5 text-muted-foreground" />{owner.phone}</a> },
                  { label: "Secondary phone", value: owner.secondaryPhone },
                  { label: "E-mail", value: owner.email && <a className="inline-flex items-center gap-1.5 hover:underline" href={`mailto:${owner.email}`}><Mail className="size-3.5 text-muted-foreground" />{owner.email}</a> },
                  { label: "Nationality", value: owner.nationality },
                  { label: "Added", value: `${formatDate(owner.createdAt)}${owner.createdBy ? ` by ${owner.createdBy.name}` : ""}` },
                ]}
              />
              {owner.notes && <p className="mt-4 rounded-md bg-muted/60 p-3 text-sm whitespace-pre-wrap">{owner.notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Properties owned</CardTitle>
            </CardHeader>
            {owner.properties.length === 0 ? (
              <CardContent>
                <EmptyState compact icon={Building2} title="No properties linked" />
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {owner.properties.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/properties/${p.id}`} className="flex items-center gap-3 hover:underline">
                          <PropertyImage src={p.images[0]?.url} alt="" className="h-9 w-12 shrink-0 rounded" iconClassName="size-3.5" />
                          <span className="min-w-0">
                            <span className="line-clamp-1 font-medium">{p.title}</span>
                            <span className="text-xs text-muted-foreground">{p.reference} · {p.area}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell><EnumBadge meta={PROPERTY_STATUS_META} value={p.status} dot /></TableCell>
                      <TableCell><EnumBadge meta={PURPOSE_META} value={p.purpose} /></TableCell>
                      <TableCell className="tabular text-right whitespace-nowrap">{formatMoney(p.price, p.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deals</CardTitle>
            </CardHeader>
            {owner.deals.length === 0 ? (
              <CardContent>
                <EmptyState compact icon={Handshake} title="No deals yet" />
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {owner.deals.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Link href={`/deals/${d.id}`} className="font-medium hover:underline">{d.reference}</Link>
                        <p className="text-xs text-muted-foreground">{DEAL_TYPE_META[d.type].label} · {d.property.reference}</p>
                      </TableCell>
                      <TableCell className="text-[13px]">{d.client.fullName}</TableCell>
                      <TableCell><EnumBadge meta={DEAL_STATUS_META} value={d.status} /></TableCell>
                      <TableCell className="tabular text-right">{formatMoney(d.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <NotesPanel target="owner" targetId={owner.id} notes={notes} currentUserId={user.id} isManager={can.viewTeam(user)} />
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
