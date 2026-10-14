"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Plus, X } from "lucide-react";
import type { ActionResult } from "@/types/action";
import { useAction } from "@/hooks/use-action";
import { PROPERTY_STATUS_META } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { PropertyImage } from "@/components/shared/property-image";
import { EntityCombobox } from "@/components/shared/form/entity-combobox";
import type { PropertyStatus, ListingPurpose } from "@/generated/prisma/enums";

export interface InterestProperty {
  id: string;
  reference: string;
  title: string;
  area: string;
  status: PropertyStatus;
  price: number;
  currency: string;
  purpose: ListingPurpose;
  images: { url: string }[];
}

/** Properties a lead/client is interested in, with add/remove. */
export function InterestList<K extends "leadId" | "clientId">({
  ownerKey,
  ownerId,
  properties,
  add,
  remove,
}: {
  ownerKey: K;
  ownerId: string;
  properties: InterestProperty[];
  add: (input: Record<K, string> & { propertyId: string }) => Promise<ActionResult<unknown>>;
  remove: (input: Record<K, string> & { propertyId: string }) => Promise<ActionResult<unknown>>;
}) {
  const [adding, setAdding] = useState(false);
  const addAction = useAction(add, { onSuccess: () => setAdding(false) });
  const removeAction = useAction(remove);
  const payload = (propertyId: string) => ({ [ownerKey]: ownerId, propertyId }) as Record<K, string> & { propertyId: string };

  return (
    <div className="space-y-3">
      {properties.length === 0 && !adding && <EmptyState compact icon={Building2} title="No properties shortlisted" />}
      <ul className="divide-y">
        {properties.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0">
            <PropertyImage src={p.images[0]?.url} alt="" className="h-10 w-14 shrink-0 rounded" iconClassName="size-3.5" />
            <div className="min-w-0 flex-1">
              <Link href={`/properties/${p.id}`} className="line-clamp-1 text-sm font-medium hover:underline">
                {p.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {p.reference} · {p.area} · {formatMoney(p.price, p.currency)}
                {p.purpose === "RENT" ? "/mo" : ""}
              </p>
            </div>
            <EnumBadge meta={PROPERTY_STATUS_META} value={p.status} />
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground" disabled={removeAction.pending} onClick={() => void removeAction.run(payload(p.id))} aria-label={`Remove ${p.reference}`}>
              <X />
            </Button>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="flex gap-2">
          <div className="flex-1">
            <EntityCombobox kind="property" value={null} onChange={(id) => id && void addAction.run(payload(id))} placeholder="Search listings to add…" clearable={false} />
          </div>
          <Button variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus /> Add property
        </Button>
      )}
    </div>
  );
}
