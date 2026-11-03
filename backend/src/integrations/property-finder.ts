import "server-only";
import type { PropertyStatus } from "@/generated/prisma/enums";
import { fetchJsonFeed } from "./remote";
import { amenityList, areaSqm, asRecord, categoryFrom, contactFrom, furnishingFrom, imageUrls, int, isoDate, longText, num, pick, propertyTypeFrom, purposeFrom, required, str, type Raw } from "./mapping";
import { ListingError, type ListingAdapter, type NormalizedListing } from "./types";

/**
 * Property Finder adapter.
 *
 * Field mapping follows Property Finder's listing feed (the XML "CRM feed" format, as JSON —
 * `reference_number`, `offering_type` RS/RR/CS/CR, `property_type` codes, `title_en`,
 * `description_en`, `price`, `size`, `bedroom`, `bathroom`, `community`, `sub_community`,
 * `property_name`, `agent{…}`, `photo.url[]`, `private_amenities`, `geopoint`, `last_update`).
 * Common camelCase/snake_case alternatives are accepted too. This mapping is PROVISIONAL:
 * verify it against your account's export before relying on scheduled imports.
 *
 * Remote fetch: set PROPERTY_FINDER_FEED_URL (a JSON export URL you have access to) and,
 * if the endpoint needs it, PROPERTY_FINDER_API_KEY (sent as a Bearer token). No endpoint is
 * hard-coded — Property Finder issues feed/API access per agency.
 */

const env = () => ({ url: process.env.PROPERTY_FINDER_FEED_URL?.trim() || "", key: process.env.PROPERTY_FINDER_API_KEY?.trim() || "" });

/** Rent prices are stored monthly in the CRM; PF sends yearly/monthly objects or a single number. */
function priceOf(raw: Raw, purpose: "RENT" | "SALE"): number | null {
  const p = pick(raw, "price", "price_value", "priceValue");
  if (p && typeof p === "object" && !Array.isArray(p)) {
    const v = p as Raw;
    if (purpose === "RENT") {
      const monthly = num(v.monthly);
      if (monthly) return Math.round(monthly);
      const yearly = num(v.yearly ?? v.annual);
      if (yearly) return Math.round(yearly / 12);
    }
    return int(v.value ?? v.amount ?? v.sale ?? v.yearly ?? v.monthly);
  }
  const n = num(p);
  if (n === null) return null;
  const period = String(pick(raw, "rent_frequency", "rentFrequency", "price_period") ?? "").toLowerCase();
  return Math.round(purpose === "RENT" && /year|annual/.test(period) ? n / 12 : n);
}

function geo(raw: Raw): { latitude: number | null; longitude: number | null } {
  const g = pick(raw, "geopoint", "geo", "coordinates");
  if (typeof g === "string" && g.includes(",")) {
    const [a, b] = g.split(",").map((x) => num(x));
    // PF's geopoint is "longitude,latitude".
    return { latitude: b ?? null, longitude: a ?? null };
  }
  return { latitude: num(pick(raw, "latitude", "lat", "geo.lat")), longitude: num(pick(raw, "longitude", "lng", "lon", "geo.lng")) };
}

export const PropertyFinderAdapter: ListingAdapter = {
  source: "PROPERTY_FINDER",
  label: "Property Finder",

  status() {
    const { url, key } = env();
    return {
      remoteConfigured: Boolean(url),
      env: [
        { name: "PROPERTY_FINDER_FEED_URL", set: Boolean(url), required: false },
        { name: "PROPERTY_FINDER_API_KEY", set: Boolean(key), required: false },
      ],
      notes: [
        url ? "A JSON feed URL is configured — “Fetch from feed” imports it." : "No feed URL configured — upload a JSON export, or set PROPERTY_FINDER_FEED_URL.",
        "Field mapping follows Property Finder's listing feed format and is provisional until checked against your export.",
      ],
    };
  },

  async fetchRemote() {
    const { url, key } = env();
    if (!url) throw new ListingError("PROPERTY_FINDER_FEED_URL is not set.");
    return fetchJsonFeed("Property Finder", url, key || undefined);
  },

  externalIdOf(raw) {
    try {
      return str(pick(asRecord(raw), "reference_number", "referenceNumber", "reference", "id", "listing_id"), 120);
    } catch {
      return null;
    }
  },

  normalize(input): NormalizedListing {
    const raw = asRecord(input);
    const externalId = required(this.externalIdOf(raw), "Missing reference_number / id");
    const offering = pick(raw, "offering_type", "offeringType", "purpose", "listing_type");
    const purpose = required(purposeFrom(offering), `Unknown offering type “${str(offering, 40) ?? ""}” (expected RS, RR, CS, CR, sale or rent)`);
    const typeRaw = pick(raw, "property_type", "propertyType", "type", "category.name");
    const propertyType = required(propertyTypeFrom(typeRaw), `Unknown property type “${str(typeRaw, 40) ?? ""}”`);
    const agent = contactFrom(pick(raw, "agent"));
    const completion = String(pick(raw, "completion_status", "status") ?? "").toLowerCase();
    const status: PropertyStatus = /off.?plan|under construction/.test(completion) ? "AVAILABLE" : /sold/.test(completion) ? "SOLD" : /rented|leased/.test(completion) ? "RENTED" : "AVAILABLE";
    const amenities = amenityList([...amenityList(pick(raw, "private_amenities", "privateAmenities")), ...amenityList(pick(raw, "commercial_amenities", "commercialAmenities")), ...amenityList(pick(raw, "amenities"))]);
    const community = str(pick(raw, "community", "location.community", "area"), 120);
    const subCommunity = str(pick(raw, "sub_community", "subCommunity", "location.sub_community"), 120);
    const { latitude, longitude } = geo(raw);

    return {
      source: "PROPERTY_FINDER",
      externalId,
      title: str(pick(raw, "title_en", "title", "titleEn"), 200) ?? `${propertyType.toLowerCase()} in ${community ?? "Qatar"}`,
      description: longText(pick(raw, "description_en", "description", "descriptionEn")),
      propertyType,
      category: categoryFrom(offering, propertyType),
      // Property Finder feeds come from brokerages: company listings unless marked as owner/private.
      subcategory: /owner|private|landlord/i.test(String(pick(raw, "listed_by", "seller_type", "listing_owner") ?? "")) ? "PRIVATE" : "COMPANY",
      purpose,
      status,
      price: required(priceOf(raw, purpose), "Missing or invalid price"),
      currency: (str(pick(raw, "currency", "price.currency"), 3) ?? "QAR").toUpperCase(),
      bedrooms: int(pick(raw, "bedroom", "bedrooms", "beds")),
      bathrooms: int(pick(raw, "bathroom", "bathrooms", "baths")),
      areaSqm: areaSqm(pick(raw, "size", "area", "plot_size", "builtup_area"), pick(raw, "size_unit", "area_unit")),
      city: str(pick(raw, "city", "location.city"), 80) ?? "Doha",
      location: required(subCommunity ?? community, "Missing community / location"),
      address: str(pick(raw, "street", "address"), 200),
      building: str(pick(raw, "property_name", "building", "tower", "propertyName"), 160),
      floor: int(pick(raw, "floor", "floor_number")),
      furnishing: furnishingFrom(pick(raw, "furnished", "furnishing")),
      amenities,
      images: imageUrls(pick(raw, "photo", "photos", "images", "media.images")),
      agent,
      contact: agent ? { ...agent, company: agent.company ?? str(pick(raw, "company", "broker_name"), 160) } : null,
      availableFrom: isoDate(pick(raw, "availability_date", "available_from")),
      sourceUrl: str(pick(raw, "url", "listing_url", "share_url", "link"), 2000),
      latitude,
      longitude,
      metadata: {
        permitNumber: str(pick(raw, "permit_number", "permitNumber", "rera_permit"), 80),
        parking: int(pick(raw, "parking", "parking_spaces")),
        buildYear: int(pick(raw, "build_year", "year_built")),
        community,
        subCommunity,
        priceOnApplication: /^(yes|true|1)$/i.test(String(pick(raw, "price_on_application") ?? "")),
      },
      sourceCreatedAt: isoDate(pick(raw, "created_at", "createdAt")),
      sourceUpdatedAt: isoDate(pick(raw, "last_update", "updated_at", "updatedAt")),
    };
  },
};
