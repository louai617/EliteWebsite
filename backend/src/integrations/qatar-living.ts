import "server-only";
import { fetchJsonFeed } from "./remote";
import { amenityList, areaSqm, asRecord, categoryFrom, contactFrom, furnishingFrom, imageUrls, int, isoDate, longText, num, pick, propertyTypeFrom, purposeFrom, required, str } from "./mapping";
import { ListingError, type ListingAdapter, type NormalizedListing } from "./types";

/**
 * Qatar Living adapter.
 *
 * Qatar Living does not publish a public listings API, so this adapter accepts a JSON
 * export (or a feed you have contractual access to) with a generic, PROVISIONAL mapping:
 * `id`, `title`, `description`, `category` (residential/commercial), `type`, `purpose`/`for`
 * (rent/sale), `price`, `currency`, `bedrooms`, `bathrooms`, `size`, `location`/`area`,
 * `address`, `building`, `floor`, `furnishing`, `amenities[]`, `images[]`,
 * `agent{}`/`contact{}`, `seller_type` (agency/owner), `url`, `created_at`, `updated_at`.
 * Adjust the keys below once you have a real sample.
 *
 * Remote fetch: QATAR_LIVING_FEED_URL (+ optional QATAR_LIVING_API_KEY as Bearer token).
 */

const env = () => ({ url: process.env.QATAR_LIVING_FEED_URL?.trim() || "", key: process.env.QATAR_LIVING_API_KEY?.trim() || "" });

export const QatarLivingAdapter: ListingAdapter = {
  source: "QATAR_LIVING",
  label: "Qatar Living",

  status() {
    const { url, key } = env();
    return {
      remoteConfigured: Boolean(url),
      env: [
        { name: "QATAR_LIVING_FEED_URL", set: Boolean(url), required: false },
        { name: "QATAR_LIVING_API_KEY", set: Boolean(key), required: false },
      ],
      notes: [
        url ? "A JSON feed URL is configured — “Fetch from feed” imports it." : "No feed URL configured — upload a JSON export, or set QATAR_LIVING_FEED_URL.",
        "Qatar Living has no public listings API; the field mapping is provisional and should be checked against a real export.",
      ],
    };
  },

  async fetchRemote() {
    const { url, key } = env();
    if (!url) throw new ListingError("QATAR_LIVING_FEED_URL is not set.");
    return fetchJsonFeed("Qatar Living", url, key || undefined);
  },

  externalIdOf(raw) {
    try {
      return str(pick(asRecord(raw), "id", "ad_id", "adId", "listing_id", "nid", "reference"), 120);
    } catch {
      return null;
    }
  },

  normalize(input): NormalizedListing {
    const raw = asRecord(input);
    const externalId = required(this.externalIdOf(raw), "Missing listing id");
    const purposeRaw = pick(raw, "purpose", "for", "offer_type", "listing_type", "category.purpose");
    const purpose = required(purposeFrom(purposeRaw), `Unknown purpose “${str(purposeRaw, 40) ?? ""}” (expected rent or sale)`);
    const typeRaw = pick(raw, "type", "property_type", "propertyType", "subcategory");
    const propertyType = required(propertyTypeFrom(typeRaw), `Unknown property type “${str(typeRaw, 40) ?? ""}”`);
    const agent = contactFrom(pick(raw, "agent"));
    const contact = contactFrom(pick(raw, "contact", "seller", "owner")) ?? agent;
    const seller = String(pick(raw, "seller_type", "sellerType", "posted_by", "advertiser_type") ?? "").toLowerCase();
    const period = String(pick(raw, "price_period", "rent_period", "price_type") ?? "").toLowerCase();
    const rawPrice = num(pick(raw, "price", "price.amount", "price.value"));
    const price = rawPrice === null ? null : Math.round(purpose === "RENT" && /year|annual/.test(period) ? rawPrice / 12 : rawPrice);
    const location = str(pick(raw, "location", "area", "neighbourhood", "neighborhood", "location.area", "district"), 120);

    return {
      source: "QATAR_LIVING",
      externalId,
      title: required(str(pick(raw, "title", "name", "headline"), 200), "Missing title"),
      description: longText(pick(raw, "description", "body", "details")),
      propertyType,
      category: categoryFrom(pick(raw, "category", "property_category", "category.name"), propertyType),
      // Agency / broker / company ads are company listings; owner/landlord ads are private.
      subcategory: /agen|broker|company|developer/.test(seller) || (!seller && agent) ? "COMPANY" : "PRIVATE",
      purpose,
      status: "AVAILABLE",
      price: required(price, "Missing or invalid price"),
      currency: (str(pick(raw, "currency", "price.currency"), 3) ?? "QAR").toUpperCase(),
      bedrooms: int(pick(raw, "bedrooms", "beds", "rooms")),
      bathrooms: int(pick(raw, "bathrooms", "baths")),
      areaSqm: areaSqm(pick(raw, "size", "area_sqm", "size_sqm", "property_size"), pick(raw, "size_unit", "area_unit")),
      city: str(pick(raw, "city", "location.city"), 80) ?? "Doha",
      location: required(location, "Missing location / area"),
      address: str(pick(raw, "address", "street"), 200),
      building: str(pick(raw, "building", "building_name", "tower", "compound"), 160),
      floor: int(pick(raw, "floor")),
      furnishing: furnishingFrom(pick(raw, "furnishing", "furnished")),
      amenities: amenityList(pick(raw, "amenities", "features")),
      images: imageUrls(pick(raw, "images", "photos", "gallery")),
      agent,
      contact,
      availableFrom: isoDate(pick(raw, "available_from", "availability_date")),
      sourceUrl: str(pick(raw, "url", "link", "permalink"), 2000),
      latitude: num(pick(raw, "latitude", "lat", "location.lat")),
      longitude: num(pick(raw, "longitude", "lng", "location.lng")),
      metadata: { sellerType: seller || null, views: int(pick(raw, "views", "view_count")), featured: Boolean(pick(raw, "featured", "is_featured")) },
      sourceCreatedAt: isoDate(pick(raw, "created_at", "created", "posted_at", "date")),
      sourceUpdatedAt: isoDate(pick(raw, "updated_at", "changed", "modified")),
    };
  },
};
