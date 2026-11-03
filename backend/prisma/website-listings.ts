/**
 * Moves the listings that used to be hard-coded in the website (frontend/src/data/properties.ts,
 * exported to samples/website-listings.json) into the CRM, which is now the single source of
 * truth for every property shown on eliterealestate.qa.
 *
 * Idempotent: listings are matched by reference (ELT-00123…); existing ones are left untouched,
 * so running it again never duplicates or overwrites anything an agent edited.
 * Used by the seed and by `npm run import:website-listings` for existing databases.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../src/generated/prisma/client";

interface WebsiteListing {
  reference_number: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  type: "apartment" | "villa" | "penthouse" | "townhouse";
  purpose: "sale" | "rent";
  price: number;
  currency: string;
  price_frequency?: "year" | "month";
  bedrooms: number;
  bathrooms: number;
  area_sqm: number;
  plot_sqm?: number;
  floor?: number;
  total_floors?: number;
  parking: number;
  furnishing: "furnished" | "semi_furnished" | "unfurnished";
  completion: "ready" | "offplan";
  ownership: "freehold" | "leasehold" | "usufruct";
  available_from: string;
  handover?: string;
  developer_en?: string;
  year_built?: number;
  service_charge_sqm?: number;
  location: { city_en: string; area_en: string; community_en: string; address_en: string; lat: number; lng: number };
  amenities: string[];
  highlights: string[];
  images: string[];
  is_featured: boolean;
  is_verified: boolean;
  is_exclusive: boolean;
  listed_days_ago: number;
  nearby: { category: string; name_en: string; name_ar: string; minutes: number; mode: "drive" | "walk" }[];
  payment_plan?: { key: string; percent: number; timing_en: string; timing_ar: string }[];
  agent_name: string;
  agent_email: string;
}

/** Website amenity keys that are amenity flags in the CRM. */
const FLAG_FOR_AMENITY: Record<string, string> = {
  balcony: "hasBalcony",
  maid_room: "hasMaidRoom",
  shared_pool: "hasPool",
  shared_gym: "hasGym",
  sea_view: "hasSeaView",
  private_garden: "hasGarden",
  barbecue_area: "hasBbq",
  security: "hasSecurity",
  central_ac: "hasCentralAc",
};

export function loadWebsiteListings(): WebsiteListing[] {
  return JSON.parse(readFileSync(path.join(process.cwd(), "samples", "website-listings.json"), "utf8"));
}

export async function importWebsiteListings(
  db: PrismaClient,
  options: { fallbackAgentIds?: string[]; log?: (line: string) => void } = {},
) {
  const log = options.log ?? console.log;
  const listings = loadWebsiteListings();
  let created = 0;
  for (const [i, l] of listings.entries()) {
    const exists = await db.property.findUnique({ where: { reference: l.reference_number }, select: { id: true } });
    if (exists) {
      log(`  ${l.reference_number} already in the CRM — kept as is`);
      continue;
    }
    const agent =
      (await db.user.findFirst({ where: { email: l.agent_email, isActive: true, role: { in: ["AGENT", "MANAGER", "ADMIN"] } }, select: { id: true } })) ??
      (await db.user.findFirst({ where: { name: l.agent_name, isActive: true, role: { in: ["AGENT", "MANAGER", "ADMIN"] } }, select: { id: true } }));
    const agentId = agent?.id ?? options.fallbackAgentIds?.[i % options.fallbackAgentIds.length] ?? null;
    const flags = Object.fromEntries(l.amenities.filter((a) => FLAG_FOR_AMENITY[a]).map((a) => [FLAG_FOR_AMENITY[a], true]));
    const extras = l.amenities.filter((a) => !FLAG_FOR_AMENITY[a]);
    const listedAt = new Date(Date.now() - l.listed_days_ago * 86_400_000);
    // CRM rent prices are monthly.
    const price = l.purpose === "rent" && l.price_frequency === "year" ? Math.round(l.price / 12) : l.price;

    await db.property.create({
      data: {
        reference: l.reference_number,
        title: l.title_en,
        titleAr: l.title_ar,
        description: l.description_en,
        descriptionAr: l.description_ar,
        type: l.type.toUpperCase() as "APARTMENT" | "VILLA" | "PENTHOUSE" | "TOWNHOUSE",
        category: "RESIDENTIAL",
        subcategory: "COMPANY",
        purpose: l.purpose === "sale" ? "SALE" : "RENT",
        status: "AVAILABLE",
        price,
        currency: l.currency,
        areaSqm: l.area_sqm,
        plotSqm: l.plot_sqm ?? null,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        floor: l.floor ?? null,
        totalFloors: l.total_floors ?? null,
        parkingSpaces: l.parking,
        furnishing: l.furnishing.toUpperCase() as "FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED",
        completionStatus: l.completion === "offplan" ? "OFF_PLAN" : "READY",
        ownershipType: l.ownership.toUpperCase() as "FREEHOLD" | "LEASEHOLD" | "USUFRUCT",
        availableFrom: new Date(l.available_from),
        handover: l.handover ?? null,
        developer: l.developer_en ?? null,
        yearBuilt: l.year_built ?? null,
        serviceChargeSqm: l.service_charge_sqm ?? null,
        city: l.location.city_en,
        area: l.location.area_en,
        buildingName: l.location.community_en,
        latitude: l.location.lat,
        longitude: l.location.lng,
        ...flags,
        amenities: extras.length ? JSON.stringify(extras) : null,
        highlights: l.highlights.length ? JSON.stringify(l.highlights) : null,
        nearby: l.nearby.length ? JSON.stringify(l.nearby.map((n) => ({ category: n.category, nameEn: n.name_en, nameAr: n.name_ar, minutes: n.minutes, mode: n.mode }))) : null,
        paymentPlan: l.payment_plan?.length ? JSON.stringify(l.payment_plan.map((m) => ({ key: m.key, percent: m.percent, timingEn: m.timing_en, timingAr: m.timing_ar }))) : null,
        isFeatured: l.is_featured,
        isVerified: l.is_verified,
        isExclusive: l.is_exclusive,
        websitePublished: true,
        websitePublishedAt: listedAt,
        createdAt: listedAt,
        agentId,
        images: { create: l.images.map((url, sortOrder) => ({ url, sortOrder, isPrimary: sortOrder === 0 })) },
      },
    });
    created++;
    log(`  ${l.reference_number} imported${agentId ? "" : " (unassigned — assign an agent in the CRM)"}`);
  }
  return { total: listings.length, created };
}
