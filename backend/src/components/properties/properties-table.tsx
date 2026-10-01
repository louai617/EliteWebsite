"use client";

import Link from "next/link";
import { Building2, Star } from "lucide-react";
import type { PropertyListItem } from "@/services/properties";
import { FURNISHING_META, PROPERTY_CATEGORY_META, PROPERTY_STATUS_META, PROPERTY_SUBCATEGORY_META, PROPERTY_TYPE_META, PURPOSE_META } from "@/lib/constants";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { Viewer } from "@/types/options";
import { DataTable, type Column } from "@/components/shared/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { PropertyImage } from "@/components/shared/property-image";
import { AgentCell } from "@/components/shared/user-avatar";
import { PropertyRowActions } from "./property-actions";

export function PropertiesTable({ rows, viewer, filtered }: { rows: PropertyListItem[]; viewer: Viewer; filtered: boolean }) {
  const columns: Column<PropertyListItem>[] = [
    {
      id: "property",
      header: "Property",
      sortKey: "title",
      cell: (p) => (
        <div className="flex min-w-[260px] items-center gap-3">
          <PropertyImage src={p.imageUrl} alt="" className="h-11 w-16 shrink-0 rounded-md" iconClassName="size-4" />
          <div className="min-w-0">
            <Link href={`/properties/${p.id}`} className="line-clamp-1 font-medium hover:underline">
              {p.title}
            </Link>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono">{p.reference}</span>· {p.area}
              {p.isFeatured && <Star className="size-3 fill-gold text-gold" aria-label="Featured" />}
            </p>
          </div>
        </div>
      ),
    },
    { id: "status", header: "Status", cell: (p) => <EnumBadge meta={PROPERTY_STATUS_META} value={p.status} dot /> },
    {
      id: "class",
      header: "Category",
      cell: (p) => (
        <span className="flex flex-col gap-0.5 text-[13px] leading-tight whitespace-nowrap">
          <span>{PROPERTY_CATEGORY_META[p.category].label}</span>
          <span className="text-xs text-muted-foreground">{PROPERTY_SUBCATEGORY_META[p.subcategory].label}</span>
        </span>
      ),
    },
    { id: "purpose", header: "Purpose", cell: (p) => <EnumBadge meta={PURPOSE_META} value={p.purpose} /> },
    { id: "type", header: "Type", cell: (p) => <span className="text-[13px]">{PROPERTY_TYPE_META[p.type].label}</span> },
    {
      id: "price",
      header: "Price",
      sortKey: "price",
      className: "text-right",
      headClassName: "text-right",
      cell: (p) => (
        <span className="tabular font-medium whitespace-nowrap">
          {formatMoney(p.price, p.currency)}
          {p.purpose === "RENT" && <span className="font-normal text-muted-foreground">/mo</span>}
        </span>
      ),
    },
    { id: "beds", header: "Beds", sortKey: "bedrooms", className: "tabular text-center", headClassName: "text-center", cell: (p) => (p.bedrooms === 0 ? "Studio" : p.bedrooms ?? "—") },
    { id: "size", header: "Size", sortKey: "areaSqm", className: "tabular whitespace-nowrap", cell: (p) => (p.areaSqm ? `${formatNumber(p.areaSqm)} sqm` : "—") },
    { id: "furnishing", header: "Furnishing", defaultHidden: true, cell: (p) => (p.furnishing ? FURNISHING_META[p.furnishing].label : "—") },
    { id: "agent", header: "Agent", cell: (p) => <AgentCell agent={p.agent} /> },
    { id: "owner", header: "Owner", defaultHidden: true, cell: (p) => (p.owner ? <Link href={`/owners/${p.owner.id}`} className="text-[13px] hover:underline">{p.owner.fullName}</Link> : <span className="text-muted-foreground">—</span>) },
    { id: "interest", header: "Leads", defaultHidden: true, className: "tabular text-center", headClassName: "text-center", cell: (p) => p._count.interests },
    { id: "updated", header: "Updated", sortKey: "updatedAt", className: "text-xs whitespace-nowrap text-muted-foreground", cell: (p) => formatDate(p.updatedAt) },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      className: "w-10 text-right",
      cell: (p) => <PropertyRowActions property={p} canEdit={viewer.isManager || p.agentId === viewer.id} canDelete={viewer.isManager} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(p) => p.id}
      rowHref={(p) => `/properties/${p.id}`}
      storageKey="properties"
      empty={
        <EmptyState
          icon={Building2}
          title={filtered ? "No properties match these filters" : "No properties yet"}
          description={filtered ? "Try widening the price range or clearing a filter." : "Add your first listing to start matching leads."}
        />
      }
    />
  );
}

export function PropertyGrid({ rows, filtered }: { rows: PropertyListItem[]; filtered: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <EmptyState icon={Building2} title={filtered ? "No properties match these filters" : "No properties yet"} />
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {rows.map((p) => (
        <Link key={p.id} href={`/properties/${p.id}`} className="group overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(20,16,10,0.04)] transition-colors hover:border-foreground/20">
          <div className="relative">
            <PropertyImage src={p.imageUrl} alt={p.title} className="aspect-[16/10] w-full" />
            <div className="absolute top-2 left-2 flex gap-1">
              <EnumBadge meta={PROPERTY_STATUS_META} value={p.status} className="shadow-sm" />
              {p.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-xs font-medium text-gold-foreground shadow-sm">
                  <Star className="size-3 fill-gold text-gold" /> Featured
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5 p-3.5">
            <p className="tabular text-base font-semibold">
              {formatMoney(p.price, p.currency)}
              {p.purpose === "RENT" && <span className="text-sm font-normal text-muted-foreground"> /month</span>}
            </p>
            <p className="line-clamp-1 text-sm font-medium group-hover:underline">{p.title}</p>
            <p className="text-xs text-muted-foreground">
              {p.reference} · {p.area} · {PROPERTY_TYPE_META[p.type].label}
            </p>
            <p className="text-xs text-muted-foreground">
              {PROPERTY_CATEGORY_META[p.category].label} · {PROPERTY_SUBCATEGORY_META[p.subcategory].label}
            </p>
            <p className="text-xs text-muted-foreground">
              {[p.bedrooms === 0 ? "Studio" : p.bedrooms ? `${p.bedrooms} bd` : null, p.bathrooms ? `${p.bathrooms} ba` : null, p.areaSqm ? `${formatNumber(p.areaSqm)} sqm` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
