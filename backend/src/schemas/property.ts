import { z } from "zod";
import { CompletionStatus, Furnishing, ListingPurpose, OwnershipType, PropertyCategory, PropertyStatus, PropertySubcategory, PropertyType } from "@/generated/prisma/enums";
import { EXTRA_AMENITIES, HIGHLIGHTS, NEARBY_CATEGORIES, PAYMENT_MILESTONES, PROPERTY_CATEGORY_META, PROPERTY_TYPE_META, PROPERTY_TYPES_BY_CATEGORY, categoryForType } from "@/lib/constants";
import { checkbox, id, money, optionalDate, optionalFloat, optionalId, optionalInt, optionalText, optionalUrl, requiredText } from "./common";

const optionalEnum = <T extends Record<string, string>>(e: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(e).nullable());

/** Accepts an array or its JSON string (database rows), so PATCH merges validate too. */
const jsonList = <T extends z.ZodType>(item: T, max: number) =>
  z.preprocess((v) => {
    if (typeof v === "string") {
      try {
        return v ? JSON.parse(v) : [];
      } catch {
        return [];
      }
    }
    return v ?? [];
  }, z.array(item).max(max));

const keyOf = <T extends readonly { value: string }[]>(list: T) => z.enum(list.map((i) => i.value) as [T[number]["value"], ...T[number]["value"][]]);

export const nearbyPlaceSchema = z.object({
  category: keyOf(NEARBY_CATEGORIES),
  nameEn: requiredText(120, "Name"),
  nameAr: z.string().trim().max(120).optional().default(""),
  minutes: z.coerce.number({ error: "Minutes" }).int().min(1, "1+").max(240),
  mode: z.enum(["drive", "walk"]),
});
export type NearbyPlace = z.output<typeof nearbyPlaceSchema>;

export const paymentMilestoneSchema = z.object({
  key: keyOf(PAYMENT_MILESTONES),
  percent: z.coerce.number({ error: "Percent" }).min(1).max(100),
  timingEn: requiredText(80, "Timing"),
  timingAr: z.string().trim().max(80).optional().default(""),
});
export type PaymentMilestone = z.output<typeof paymentMilestoneSchema>;

const propertyFields = z.object({
  title: requiredText(160, "Title"),
  type: z.enum(PropertyType, { error: "Choose a property type" }),
  /** Residential / Commercial. Optional for API clients: derived from `type` when omitted. */
  category: z.preprocess((v) => (v === "" ? undefined : v), z.enum(PropertyCategory, { error: "Choose residential or commercial" }).optional()),
  /** Company / Private. */
  subcategory: z.preprocess((v) => (v === "" || v === undefined ? "PRIVATE" : v), z.enum(PropertySubcategory, { error: "Choose company or private" })),
  purpose: z.enum(ListingPurpose, { error: "Choose rent or sale" }),
  status: z.enum(PropertyStatus),
  price: money("Price"),
  currency: z.string().trim().length(3, "Use a 3-letter currency code").toUpperCase().default("QAR"),
  areaSqm: optionalFloat(1, 1_000_000),
  bedrooms: optionalInt(0, 50),
  bathrooms: optionalInt(0, 50),
  floor: optionalInt(-5, 200),
  buildingNumber: optionalText(40),
  tower: optionalText(80),
  yearBuilt: optionalInt(1900, new Date().getFullYear() + 5),

  country: requiredText(80, "Country"),
  city: requiredText(80, "City"),
  area: requiredText(120, "Area"),
  street: optionalText(160),
  buildingName: optionalText(160),
  googleMapsUrl: optionalUrl,
  latitude: optionalFloat(-90, 90),
  longitude: optionalFloat(-180, 180),

  furnishing: optionalEnum(Furnishing),
  description: optionalText(5000),
  parkingSpaces: optionalInt(0, 50).transform((v) => v ?? 0),
  hasBalcony: checkbox,
  hasMaidRoom: checkbox,
  hasPool: checkbox,
  hasGym: checkbox,
  hasSeaView: checkbox,
  hasMarinaView: checkbox,
  hasGarden: checkbox,
  hasBbq: checkbox,
  hasSecurity: checkbox,
  hasCentralAc: checkbox,
  hasInternet: checkbox,
  billsIncluded: checkbox,

  propertyFinderUrl: optionalUrl,
  externalUrl: optionalUrl,
  isFeatured: checkbox,
  seoTitle: optionalText(160),
  seoDescription: optionalText(320),

  // Public website (eliterealestate.qa)
  /** Shown on the website while available/reserved. Defaults to on for API clients that omit it. */
  websitePublished: z.preprocess((v) => (v === undefined ? true : v === true || v === "on" || v === "true"), z.boolean()),
  isExclusive: checkbox,
  isVerified: checkbox,
  titleAr: optionalText(160),
  descriptionAr: optionalText(5000),
  completionStatus: z.preprocess((v) => (v === "" || v == null ? "READY" : v), z.enum(CompletionStatus)),
  ownershipType: optionalEnum(OwnershipType),
  availableFrom: optionalDate,
  handover: optionalText(60),
  developer: optionalText(120),
  serviceChargeSqm: optionalFloat(0, 10_000),
  plotSqm: optionalFloat(1, 10_000_000),
  totalFloors: optionalInt(1, 300),
  amenities: jsonList(keyOf(EXTRA_AMENITIES), 30),
  highlights: jsonList(keyOf(HIGHLIGHTS), 10),
  nearby: jsonList(nearbyPlaceSchema, 12),
  paymentPlan: jsonList(paymentMilestoneSchema, 8),

  ownerId: optionalId,
  agentId: optionalId,
});

/** The property type must belong to the chosen category (e.g. no commercial villas). */
function refineCategory(value: { type: PropertyType; category?: PropertyCategory; paymentPlan?: { percent: number }[] }, ctx: z.RefinementCtx) {
  if (value.paymentPlan?.length) {
    const total = value.paymentPlan.reduce((sum, m) => sum + m.percent, 0);
    if (Math.abs(total - 100) > 0.01) ctx.addIssue({ code: "custom", path: ["paymentPlan"], message: `Payment plan adds up to ${total}% — it must total 100%` });
  }
  const category = value.category ?? categoryForType(value.type);
  if (!PROPERTY_TYPES_BY_CATEGORY[category].includes(value.type)) {
    ctx.addIssue({
      code: "custom",
      path: ["type"],
      message: `${PROPERTY_TYPE_META[value.type].label} isn't a ${PROPERTY_CATEGORY_META[category].label.toLowerCase()} property type`,
    });
  }
}

export const propertySchema = propertyFields.superRefine(refineCategory);

export type PropertyInput = z.input<typeof propertySchema>;
export type PropertyValues = z.output<typeof propertySchema>;

export const updatePropertySchema = propertyFields.extend({ id }).superRefine(refineCategory);

/** Partial update for the REST API (PATCH): only the given fields change. */
export const patchPropertySchema = propertyFields.partial().extend({ id });

export const propertyStatusSchema = z.object({ id, status: z.enum(PropertyStatus) });

/** Absolute URL or an internal upload path. */
export const imageUrl = z
  .string()
  .trim()
  .min(1, "Image URL is required")
  .max(1000)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/api/uploads/"), "Use a full https:// image URL");

export const addImageSchema = z.object({ propertyId: id, url: imageUrl });
export const imageIdSchema = z.object({ imageId: id });
export const reorderImagesSchema = z.object({ propertyId: id, imageIds: z.array(id).min(1).max(100) });
