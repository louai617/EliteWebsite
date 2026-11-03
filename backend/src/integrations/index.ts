import "server-only";
import type { ExternalSource } from "@/generated/prisma/enums";
import { PropertyFinderAdapter } from "./property-finder";
import { QatarLivingAdapter } from "./qatar-living";
import type { ListingAdapter } from "./types";

/** Registry of listing sources. Adding a portal = writing one adapter and registering it here. */
export const ADAPTERS: Record<ExternalSource, ListingAdapter> = {
  PROPERTY_FINDER: PropertyFinderAdapter,
  QATAR_LIVING: QatarLivingAdapter,
};

export const SOURCE_SLUGS: Record<string, ExternalSource> = {
  "property-finder": "PROPERTY_FINDER",
  "qatar-living": "QATAR_LIVING",
};

export function adapterFor(source: ExternalSource): ListingAdapter {
  return ADAPTERS[source];
}

export * from "./types";
