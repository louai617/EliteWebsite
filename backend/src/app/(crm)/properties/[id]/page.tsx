import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble, Building, CalendarClock, Car, Check, ExternalLink, Handshake, Layers, Lock, MapPin, Maximize, Pencil, Sofa, Star, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { toViewer } from "@/lib/viewer";
import {
  AMENITIES,
  CUSTOMER_TYPE_META,
  DEAL_STATUS_META,
  DEAL_TYPE_META,
  FURNISHING_META,
  LEAD_STATUS_META,
  PRIORITY_META,
  PROPERTY_STATUS_META,
  PROPERTY_TYPE_META,
  PURPOSE_META,
  VIEWING_STATUS_META,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { getProperty } from "@/services/properties";
import { listNotes } from "@/services/notes";
import { timeline } from "@/services/activity";
import { listAssignableUsers } from "@/services/users";
import { getSettings } from "@/services/settings";
import { deletePropertyAction } from "@/actions/properties";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { InfoList } from "@/components/shared/info-list";
import { NotesPanel } from "@/components/shared/notes-panel";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { AgentCell } from "@/components/shared/user-avatar";
import { RecordActions } from "@/components/shared/record-actions";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { PropertyGallery } from "@/components/properties/property-gallery";
import { ImageManager } from "@/components/properties/image-manager";
import { PropertyStatusMenu } from "@/components/properties/property-status-menu";

export const metadata: Metadata = { title: "Property" };

function Spec({ icon: Icon, label, value }: { icon: typeof BedDouble; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border bg-card px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value ?? "—"}</p>
      </div>
    </div>
  );
}

export default async function PropertyPage({ params }: PageProps<"/properties/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const property = await getProperty(user, id);
  if (!property) notFound();

  const [notes, activity, agents, settings] = await Promise.all([listNotes("property", id), timeline("propertyId", id, 40), listAssignableUsers(), getSettings()]);
  const viewer = toViewer(user);
  const amenities = AMENITIES.filter((a) => property[a.key]);
  const propertyOption = { id: property.id, label: `${property.reference} · ${property.title}`, hint: property.area };
  const links = (
    [
      ["Google Maps", property.googleMapsUrl],
      ["Property Finder", property.propertyFinderUrl],
      ["Listing", property.externalUrl],
    ] as const
  )
    .filter(([, href]) => Boolean(href))
    .map(([label, href]) => (
      <a key={label} href={href!} target="_blank" rel="noopener noreferrer" className="mr-3 inline-flex items-center gap-1 hover:underline">
        {label} <ExternalLink className="size-3" />
      </a>
    ));
  const upcoming = property.viewings.filter((v) => new Date(v.startsAt) >= new Date() && (v.status === "SCHEDULED" || v.status === "CONFIRMED"));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Properties", href: "/properties" }, { label: property.reference }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {property.title}
            {property.isFeatured && <Star className="size-4 fill-gold text-gold" aria-label="Featured" />}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <EnumBadge meta={PROPERTY_STATUS_META} value={property.status} dot />
            <EnumBadge meta={PURPOSE_META} value={property.purpose} />
            <span className="font-mono text-xs">{property.reference}</span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {[property.buildingName, property.area, property.city].filter(Boolean).join(", ")}
            </span>
          </span>
        }
        actions={
          <>
            {property.canEdit && <PropertyStatusMenu id={property.id} status={property.status} />}
            {property.canEdit && (
              <Button variant="outline" asChild>
                <Link href={`/properties/${property.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {property.canDelete && (
              <DeleteRecordButton
                action={deletePropertyAction}
                id={property.id}
                redirectTo="/properties"
                title={`Delete ${property.reference}?`}
                description="Photos, viewings, notes and lead interests for this listing are removed. Listings with deals can't be deleted — mark them Off market instead."
              />
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <RecordActions
            agents={agents}
            viewer={viewer}
            viewing={{ propertyId: property.id, propertyOption, agentId: property.agentId }}
            lead={{ defaults: { interestedPropertyId: property.id, purpose: property.purpose, interestedArea: property.area, bedrooms: property.bedrooms ?? "" }, propertyOption }}
            task={{ propertyId: property.id, propertyOption }}
            deal={{
              propertyId: property.id,
              propertyOption,
              type: property.purpose === "SALE" ? "SALE" : "RENTAL",
              amount: property.purpose === "SALE" ? property.price : property.price * 12,
              defaults: settings,
            }}
          />
        </div>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            <PropertyGallery images={property.images} title={property.title} />
            {property.canEdit && (
              <div className="flex justify-end">
                <ImageManager propertyId={property.id} images={property.images} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Spec icon={BedDouble} label="Bedrooms" value={property.bedrooms === 0 ? "Studio" : property.bedrooms} />
            <Spec icon={Bath} label="Bathrooms" value={property.bathrooms} />
            <Spec icon={Maximize} label="Size" value={property.areaSqm ? `${formatNumber(property.areaSqm)} sqm` : null} />
            <Spec icon={Car} label="Parking" value={property.parkingSpaces} />
            <Spec icon={Building} label="Type" value={PROPERTY_TYPE_META[property.type].label} />
            <Spec icon={Sofa} label="Furnishing" value={property.furnishing ? FURNISHING_META[property.furnishing].label : null} />
            <Spec icon={Layers} label="Floor" value={property.floor ?? null} />
            <Spec icon={CalendarClock} label="Year built" value={property.yearBuilt} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {property.description ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{property.description}</p> : <p className="text-sm text-muted-foreground">No description yet.</p>}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Amenities</p>
                {amenities.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {amenities.map((a) => (
                      <li key={a.key} className="inline-flex items-center gap-1 rounded-md border bg-secondary/60 px-2 py-1 text-xs">
                        <Check className="size-3 text-emerald-600" /> {a.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="leads">
            <TabsList>
              <TabsTrigger value="leads">
                <UsersRound /> Interested ({property.interests.length})
              </TabsTrigger>
              <TabsTrigger value="viewings">
                <CalendarClock /> Viewings ({property.viewings.length})
              </TabsTrigger>
              <TabsTrigger value="deals">
                <Handshake /> Deals ({property.deals.length})
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="leads">
              <Card>
                {property.interests.length === 0 ? (
                  <CardContent className="pt-5">
                    <EmptyState compact icon={UsersRound} title="No interested leads yet" description="Leads interested in this listing appear here." />
                  </CardContent>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Since</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {property.interests.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>
                            {i.lead ? (
                              <Link href={`/leads/${i.lead.id}`} className="font-medium hover:underline">{i.lead.fullName}</Link>
                            ) : i.client ? (
                              <Link href={`/clients/${i.client.id}`} className="font-medium hover:underline">{i.client.fullName}</Link>
                            ) : null}
                            <p className="text-xs text-muted-foreground">{i.lead?.phone ?? i.client?.phone} · {i.lead ? "Lead" : "Client"}</p>
                          </TableCell>
                          <TableCell>
                            {i.lead ? (
                              <span className="flex gap-1">
                                <EnumBadge meta={LEAD_STATUS_META} value={i.lead.status} />
                                {(i.lead.priority === "HIGH" || i.lead.priority === "URGENT") && <EnumBadge meta={PRIORITY_META} value={i.lead.priority} />}
                              </span>
                            ) : i.client ? (
                              <span className="text-[13px]">{CUSTOMER_TYPE_META[i.client.clientType].label}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-[13px]">{i.lead?.agent?.name ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(i.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="viewings">
              <Card>
                {property.viewings.length === 0 ? (
                  <CardContent className="pt-5">
                    <EmptyState compact icon={CalendarClock} title="No viewings" />
                  </CardContent>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>With</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {property.viewings.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="text-[13px] whitespace-nowrap">
                            <Link href={`/viewings?view=list&q=${encodeURIComponent(property.reference)}`} className="hover:underline">{formatDateTime(v.startsAt)}</Link>
                          </TableCell>
                          <TableCell className="text-[13px]">
                            {v.lead ? <Link href={`/leads/${v.lead.id}`} className="hover:underline">{v.lead.fullName}</Link> : v.client ? <Link href={`/clients/${v.client.id}`} className="hover:underline">{v.client.fullName}</Link> : "—"}
                          </TableCell>
                          <TableCell><AgentCell agent={v.agent} /></TableCell>
                          <TableCell><EnumBadge meta={VIEWING_STATUS_META} value={v.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="deals">
              <Card>
                {property.deals.length === 0 ? (
                  <CardContent className="pt-5">
                    <EmptyState compact icon={Handshake} title="No deals on this property" />
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
                      {property.deals.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <Link href={`/deals/${d.id}`} className="font-medium hover:underline">{d.reference}</Link>
                            <p className="text-xs text-muted-foreground">{DEAL_TYPE_META[d.type].label} · {formatDate(d.closedAt ?? d.createdAt)}</p>
                          </TableCell>
                          <TableCell className="text-[13px]"><Link href={`/clients/${d.client.id}`} className="hover:underline">{d.client.fullName}</Link></TableCell>
                          <TableCell><EnumBadge meta={DEAL_STATUS_META} value={d.status} /></TableCell>
                          <TableCell className="tabular text-right">{formatMoney(d.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="activity">
              <Card>
                <CardContent className="pt-5">
                  <ActivityTimeline items={activity} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">{property.purpose === "RENT" ? "Monthly rent" : "Asking price"}</p>
              <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{formatMoney(property.price, property.currency)}</p>
              {property.areaSqm ? (
                <p className="tabular mt-1 text-xs text-muted-foreground">
                  {formatMoney(Math.round(property.price / property.areaSqm), property.currency)} / sqm{property.purpose === "RENT" ? " per month" : ""}
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-center">
                <div>
                  <p className="tabular text-lg font-semibold">{upcoming.length}</p>
                  <p className="text-[11px] text-muted-foreground">Upcoming viewings</p>
                </div>
                <div>
                  <p className="tabular text-lg font-semibold">{property.interests.length}</p>
                  <p className="text-[11px] text-muted-foreground">Interested</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
            </CardHeader>
            <CardContent>
              {property.owner ? (
                <div className="space-y-2 text-sm">
                  <Link href={`/owners/${property.owner.id}`} className="font-medium hover:underline">{property.owner.fullName}</Link>
                  <InfoList
                    columns={1}
                    items={[
                      { label: "Phone", value: <a href={`tel:${property.owner.phone.replace(/\s/g, "")}`} className="hover:underline">{property.owner.phone}</a> },
                      { label: "E-mail", value: property.owner.email && <a href={`mailto:${property.owner.email}`} className="hover:underline">{property.owner.email}</a> },
                      { label: "Notes", value: property.owner.notes, hidden: !property.owner.notes },
                    ]}
                  />
                </div>
              ) : property.ownerHidden ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="size-3.5" /> Owner details are visible to the listing agent and managers.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No owner linked.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Listing agent</CardTitle>
            </CardHeader>
            <CardContent>
              {property.agent ? (
                <div className="space-y-1.5 text-sm">
                  <AgentCell agent={property.agent} />
                  <p className="text-xs text-muted-foreground">{[property.agent.phone, property.agent.email].filter(Boolean).join(" · ")}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unassigned</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location & marketing</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoList
                columns={1}
                items={[
                  { label: "Address", value: [property.buildingName, property.tower && `Tower ${property.tower}`, property.buildingNumber && `Bldg ${property.buildingNumber}`, property.street, property.area, property.city, property.country].filter(Boolean).join(", ") },
                  { label: "Coordinates", value: property.latitude != null && property.longitude != null ? `${property.latitude}, ${property.longitude}` : null },
                  { label: "Links", value: links.length ? links : null },
                  { label: "SEO title", value: property.seoTitle },
                  { label: "Listed", value: formatDate(property.createdAt) },
                ]}
              />
            </CardContent>
          </Card>

          <NotesPanel target="property" targetId={property.id} notes={notes} currentUserId={user.id} isManager={viewer.isManager} />
        </aside>
      </div>
    </>
  );
}
