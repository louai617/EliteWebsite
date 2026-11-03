import { z } from "zod";
import { ExternalSource, Furnishing, ListingPurpose, PropertyCategory, PropertyStatus, PropertySubcategory, PropertyType } from "@/generated/prisma/enums";

/**
 * The normalized listing every adapter produces. Whatever a portal sends, it is mapped to
 * this shape first; only normalized, validated records ever reach the database.
 */
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).nullable();
const url = z.string().trim().max(2000).regex(/^https?:\/\//i, "Must be an http(s) URL");

export const contactSchema = z.object({
  name: optionalText(160),
  phone: optionalText(40),
  email: z.email().max(200).nullable(),
  company: optionalText(160),
});

export const normalizedListingSchema = z.object({
  source: z.enum(ExternalSource),
  externalId: text(120).min(1, "Missing listing ID"),
  title: text(200).min(3, "Missing title"),
  description: optionalText(20_000),
  propertyType: z.enum(PropertyType),
  category: z.enum(PropertyCategory),
  subcategory: z.enum(PropertySubcategory),
  purpose: z.enum(ListingPurpose),
  status: z.enum(PropertyStatus),
  price: z.number().int("Price must be a whole number").positive("Missing or invalid price").max(10_000_000_000),
  currency: z.string().trim().length(3),
  bedrooms: z.number().int().min(0).max(50).nullable(),
  bathrooms: z.number().int().min(0).max(50).nullable(),
  areaSqm: z.number().positive().max(10_000_000).nullable(),
  city: text(80).min(1),
  location: text(120).min(1, "Missing location / area"),
  address: optionalText(200),
  building: optionalText(160),
  floor: z.number().int().min(-5).max(300).nullable(),
  furnishing: z.enum(Furnishing).nullable(),
  amenities: z.array(text(80)).max(100),
  images: z.array(url).max(50),
  agent: contactSchema.nullable(),
  contact: contactSchema.nullable(),
  availableFrom: z.string().nullable(),
  sourceUrl: url.nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  metadata: z.record(z.string(), z.unknown()),
  sourceCreatedAt: z.string().nullable(),
  sourceUpdatedAt: z.string().nullable(),
});

export type NormalizedListing = z.infer<typeof normalizedListingSchema>;
export type Contact = z.infer<typeof contactSchema>;

/** A record-level problem with a message that is safe to show to the person running the import. */
export class ListingError extends Error {
  constructor(message: string, readonly externalId?: string | null) {
    super(message);
  }
}

export interface AdapterStatus {
  /** A remote feed URL is configured (env), so "Fetch now" is available. */
  remoteConfigured: boolean;
  /** Which env vars are set (never their values). */
  env: { name: string; set: boolean; required: boolean }[];
  notes: string[];
}

export interface ListingAdapter {
  source: ExternalSource;
  label: string;
  status(): AdapterStatus;
  /** Downloads raw listings from the configured feed. Throws a ListingError with a readable message on failure. */
  fetchRemote(): Promise<unknown[]>;
  /** The listing's ID in the raw payload (for logging even when normalization fails). */
  externalIdOf(raw: unknown): string | null;
  /** Maps one raw listing to the normalized shape (validation happens afterwards). */
  normalize(raw: unknown): NormalizedListing;
}
