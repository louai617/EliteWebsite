import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ListingPurpose, PropertyCategory, PropertyType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { AMENITIES, AMENITY_FLAG_WEBSITE_KEY, AREA_NAMES_AR } from "@/lib/constants";
import { like } from "@/lib/search";
import { getSettings } from "./settings";

/**
 * Listings for the public website (eliterealestate.qa). The CRM is the single source of truth:
 * a property is public while `websitePublished` is on and it is Available or Reserved.
 *
 * Only marketing fields leave this module — never owner details, internal notes, commission,
 * deals or private client data. Market figures are computed from the CRM's real inventory.
 */

export const PUBLIC_STATUSES = ["AVAILABLE", "RESERVED"] as const;
export const PUBLIC_SORTS = ["newest", "price_asc", "price_desc", "size_desc"] as const;
export type PublicSort = (typeof PUBLIC_SORTS)[number];

export const publicWhere: Prisma.PropertyWhereInput = { websitePublished: true, status: { in: [...PUBLIC_STATUSES] } };

export interface PublicFilters {
  q?: string;
  purpose?: ListingPurpose;
  category?: PropertyCategory;
  type?: PropertyType;
  area?: string;
  beds?: number;
  priceMin?: number;
  priceMax?: number;
  featured?: boolean;
  /** Only these listing references (the website's saved homes, kept in the visitor's browser). */
  refs?: string[];
}

const cardSelect = {
  id: true,
  reference: true,
  title: true,
  titleAr: true,
  type: true,
  category: true,
  subcategory: true,
  purpose: true,
  status: true,
  price: true,
  currency: true,
  bedrooms: true,
  bathrooms: true,
  areaSqm: true,
  parkingSpaces: true,
  city: true,
  area: true,
  buildingName: true,
  isFeatured: true,
  isVerified: true,
  isExclusive: true,
  completionStatus: true,
  websitePublishedAt: true,
  createdAt: true,
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 6, select: { url: true, blurDataUrl: true } },
  media: { select: { kind: true } },
} satisfies Prisma.PropertySelect;

const detailSelect = {
  ...cardSelect,
  description: true,
  descriptionAr: true,
  floor: true,
  totalFloors: true,
  plotSqm: true,
  furnishing: true,
  ownershipType: true,
  availableFrom: true,
  handover: true,
  developer: true,
  yearBuilt: true,
  serviceChargeSqm: true,
  street: true,
  latitude: true,
  longitude: true,
  amenities: true,
  highlights: true,
  nearby: true,
  paymentPlan: true,
  seoTitle: true,
  seoDescription: true,
  hasBalcony: true,
  hasMaidRoom: true,
  hasPool: true,
  hasGym: true,
  hasSeaView: true,
  hasMarinaView: true,
  hasGarden: true,
  hasBbq: true,
  hasSecurity: true,
  hasCentralAc: true,
  hasInternet: true,
  billsIncluded: true,
  agent: { select: { id: true, name: true, role: true, phone: true, email: true, avatarUrl: true } },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 40, select: { url: true, blurDataUrl: true } },
} satisfies Prisma.PropertySelect;

type CardRow = Prisma.PropertyGetPayload<{ select: typeof cardSelect }>;
type DetailRow = Prisma.PropertyGetPayload<{ select: typeof detailSelect }>;

const ar = (en: string | null | undefined) => (en ? (AREA_NAMES_AR[en] ?? en) : "");
const lower = <T extends string>(v: T) => v.toLowerCase() as Lowercase<T>;
const DAY = 86_400_000;

function parseList<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Upload paths become absolute URLs on this app's public origin. */
function absolute(url: string, origin: string) {
  return url.startsWith("/") ? `${origin}${url}` : url;
}

function toCard(p: CardRow, origin: string) {
  const listedAt = p.websitePublishedAt ?? p.createdAt;
  return {
    _id: p.reference,
    reference_number: p.reference,
    title_en: p.title,
    title_ar: p.titleAr || p.title,
    type: lower(p.type),
    category: lower(p.category),
    listed_by: lower(p.subcategory),
    purpose: p.purpose === "SALE" ? ("sale" as const) : ("rent" as const),
    status: lower(p.status),
    price: p.price,
    currency: p.currency,
    /** CRM rent prices are monthly. */
    price_frequency: p.purpose === "RENT" ? ("month" as const) : undefined,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    area_sqm: p.areaSqm,
    parking: p.parkingSpaces,
    completion: p.completionStatus === "OFF_PLAN" ? ("offplan" as const) : ("ready" as const),
    location: {
      city_en: p.city,
      city_ar: ar(p.city),
      area_en: p.area,
      area_ar: ar(p.area),
      community_en: p.buildingName || p.area,
      community_ar: ar(p.buildingName) || ar(p.area),
    },
    images: p.images.map((i) => absolute(i.url, origin)),
    /** Tiny blurred preview of the cover photo (data: URL) shown while it loads; null for older photos. */
    cover_blur: p.images[0]?.blurDataUrl ?? null,
    is_featured: p.isFeatured,
    is_verified: p.isVerified,
    is_exclusive: p.isExclusive,
    has_video: p.media.some((m) => m.kind === "VIDEO"),
    has_tour: p.media.some((m) => m.kind === "VIRTUAL_TOUR"),
    listed_at: listedAt.toISOString(),
    listed_days_ago: Math.max(0, Math.floor((Date.now() - listedAt.getTime()) / DAY)),
  };
}

export type PublicListingCard = ReturnType<typeof toCard>;

function orderFor(sort: PublicSort): Prisma.PropertyOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "size_desc":
      return [{ areaSqm: { sort: "desc", nulls: "last" } }, { id: "asc" }];
    default:
      return [{ isFeatured: "desc" }, { websitePublishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
  }
}

export function publicListingWhere(f: PublicFilters): Prisma.PropertyWhereInput {
  return {
    AND: [
      publicWhere,
      f.q ? { OR: [{ title: like(f.q) }, { titleAr: like(f.q) }, { reference: like(f.q) }, { area: like(f.q) }, { buildingName: like(f.q) }] } : {},
      f.purpose ? { purpose: f.purpose } : {},
      f.category ? { category: f.category } : {},
      f.type ? { type: f.type } : {},
      f.area ? { area: f.area } : {},
      f.beds !== undefined ? { bedrooms: { gte: f.beds } } : {},
      f.priceMin !== undefined ? { price: { gte: f.priceMin } } : {},
      f.priceMax !== undefined ? { price: { lte: f.priceMax } } : {},
      f.featured ? { isFeatured: true } : {},
      f.refs?.length ? { reference: { in: f.refs } } : {},
    ],
  };
}

export async function listPublicListings(filters: PublicFilters, { page, pageSize, sort }: { page: number; pageSize: number; sort: PublicSort }, origin: string) {
  const where = publicListingWhere(filters);
  const [rows, total, areas] = await Promise.all([
    db.property.findMany({ where, orderBy: orderFor(sort), skip: (page - 1) * pageSize, take: pageSize, select: cardSelect }),
    db.property.count({ where }),
    db.property.groupBy({ by: ["area"], where: publicWhere, _count: { _all: true }, orderBy: { area: "asc" } }),
  ]);
  return {
    items: rows.map((r) => toCard(r, origin)),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    facets: { areas: areas.map((a) => ({ value: a.area, label_en: a.area, label_ar: ar(a.area), count: a._count._all })) },
  };
}

/** Price per m², annualised for rentals so sale and rent series are each comparable. */
const perSqm = (p: { price: number; areaSqm: number | null; purpose: ListingPurpose }) =>
  p.areaSqm && p.areaSqm > 0 ? (p.purpose === "RENT" ? p.price * 12 : p.price) / p.areaSqm : null;

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Community stats and a 12-month price-per-m² trend from the CRM's own inventory and deals. */
async function marketFor(p: DetailRow) {
  const since = new Date(Date.now() - 365 * DAY);
  const [comparables, cityRows, inArea, buildings, deals] = await Promise.all([
    db.property.findMany({ where: { area: p.area, purpose: p.purpose, id: { not: p.id } }, select: { price: true, areaSqm: true, purpose: true, type: true, createdAt: true } }),
    db.property.findMany({ where: { city: p.city, purpose: p.purpose, createdAt: { gte: since } }, select: { price: true, areaSqm: true, purpose: true, createdAt: true } }),
    db.property.count({ where: { ...publicWhere, area: p.area } }),
    db.property.findMany({ where: { area: p.area, buildingName: { not: null } }, distinct: ["buildingName"], select: { buildingName: true } }),
    db.deal.findMany({ where: { status: "CLOSED", closedAt: { gte: since }, property: { area: p.area, purpose: p.purpose } }, select: { amount: true, type: true, closedAt: true, property: { select: { areaSqm: true } } } }),
  ]);
  const sameType = comparables.filter((c) => c.type === p.type);
  const pool = sameType.length >= 3 ? sameType : comparables;
  if (!pool.length) return null;

  // Monthly buckets: listings created + deals closed in the area vs. the whole city.
  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const community = new Map<string, number[]>();
  const city = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, d: Date, v: number | null) => {
    if (v == null || !Number.isFinite(v)) return;
    m.set(monthKey(d), [...(m.get(monthKey(d)) ?? []), v]);
  };
  for (const c of comparables) if (c.createdAt >= since) push(community, c.createdAt, perSqm(c));
  for (const d of deals) {
    const sqm = d.property.areaSqm;
    // Rental deals are stored as the contract (annual) value.
    if (sqm && d.closedAt) push(community, d.closedAt, d.amount / sqm);
  }
  for (const c of cityRows) push(city, c.createdAt, perSqm(c));
  const months = [...new Set([...community.keys()].filter((k) => city.has(k)))].sort();
  const history = months.map((k) => {
    const [y, m] = k.split("-").map(Number);
    return {
      label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      community: Math.round(avg(community.get(k)!)),
      city: Math.round(avg(city.get(k)!)),
    };
  });

  return {
    avg_price: Math.round(avg(pool.map((c) => c.price))),
    avg_size_sqm: Math.round(avg(pool.map((c) => c.areaSqm ?? 0).filter(Boolean))) || null,
    comparable_count: pool.length,
    community_listings: inArea,
    community_buildings: buildings.length,
    // A trend needs at least three months of real data; otherwise the website hides the chart.
    price_history: history.length >= 3 ? history : [],
  };
}

/** Public agent card with figures computed from CRM data. */
async function agentFor(agent: DetailRow["agent"]) {
  const settings = await getSettings();
  const since = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const [agencyListings, verifiedAgents, own, reports] = await Promise.all([
    db.property.count({ where: publicWhere }),
    db.user.count({ where: { isActive: true, role: "AGENT" } }),
    agent ? db.property.count({ where: { ...publicWhere, agentId: agent.id } }) : Promise.resolve(0),
    agent ? db.dailyReport.findMany({ where: { agentId: agent.id, date: { gte: since }, avgLeadResponseMinutes: { not: null } }, select: { avgLeadResponseMinutes: true } }) : Promise.resolve([]),
  ]);
  const responseMinutes = reports.length ? Math.round(avg(reports.map((r) => r.avgLeadResponseMinutes!))) : null;
  const agency = { agency_name_en: settings.companyName, agency_name_ar: settings.companyName, agency_listings: agencyListings, verified_agents: verifiedAgents };
  if (!agent) return { name: settings.companyName, title: "Sales team", phone: null, whatsapp: null, email: null, photo: null, response_minutes: null, listings_count: agencyListings, is_superagent: false, ...agency };
  return {
    name: agent.name,
    title: agent.role === "AGENT" ? "Property consultant" : agent.role === "MANAGER" ? "Sales manager" : "Director",
    phone: agent.phone,
    whatsapp: agent.phone ? agent.phone.replace(/[^0-9]/g, "") : null,
    email: agent.email,
    photo: agent.avatarUrl,
    response_minutes: responseMinutes,
    listings_count: own,
    /** Fast responder with a real inventory — a transparent, data-driven badge. */
    is_superagent: responseMinutes !== null && responseMinutes <= 30 && own >= 3,
    ...agency,
  };
}

function amenityKeys(p: DetailRow) {
  const fromFlags = AMENITIES.filter((a) => p[a.key]).map((a) => AMENITY_FLAG_WEBSITE_KEY[a.key]).filter((k): k is string => Boolean(k));
  return [...new Set([...fromFlags, ...parseList<string>(p.amenities)])];
}

function highlightKeys(p: DetailRow) {
  const list = parseList<string>(p.highlights);
  if (p.hasMarinaView && !list.includes("marina_view")) list.push("marina_view");
  return list;
}

export async function getPublicListing(ref: string, origin: string) {
  const p = await db.property.findFirst({ where: { AND: [publicWhere, { OR: [{ reference: ref }, { id: ref }] }] }, select: detailSelect });
  if (!p) return null;
  const nearby = parseList<{ category: string; nameEn: string; nameAr?: string; minutes: number; mode: string }>(p.nearby);
  const plan = parseList<{ key: string; percent: number; timingEn: string; timingAr?: string }>(p.paymentPlan);
  const [market, agent, similarRows, mediaRows] = await Promise.all([
    marketFor(p),
    agentFor(p.agent),
    db.property.findMany({ where: { ...publicWhere, id: { not: p.id }, purpose: p.purpose }, select: { ...cardSelect }, take: 40 }),
    db.propertyMedia.findMany({ where: { propertyId: p.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, kind: true, title: true, url: true, provider: true, embedUrl: true, mimeType: true } }),
  ]);
  // Uploaded files are served by this app; links point to YouTube, Vimeo, Matterport…
  const mediaUrl = (m: (typeof mediaRows)[number]) => (m.provider === "file" ? `${origin}/api/media/${m.id}` : (m.url ?? ""));
  const isPdf = (m: (typeof mediaRows)[number]) => m.mimeType === "application/pdf" || /\.pdf($|\?)/i.test(m.url ?? "");
  const item = (m: (typeof mediaRows)[number]) => ({ id: m.id, title: m.title, provider: m.provider, url: mediaUrl(m), embed_url: m.embedUrl, mime_type: m.mimeType });
  const brochure = mediaRows.find((m) => m.kind === "BROCHURE");
  const similar = similarRows
    .sort((a, b) => Number(b.area === p.area) - Number(a.area === p.area) || Math.abs(a.price - p.price) - Math.abs(b.price - p.price))
    .slice(0, 3)
    .map((r) => toCard(r, origin));

  return {
    ...toCard(p, origin),
    id: p.id,
    /** Blurred previews for the first 5 photos (the gallery's hero grid); null after that. */
    image_blurs: p.images.map((i, n) => (n < 5 ? i.blurDataUrl : null)),
    description_en: p.description ?? "",
    description_ar: p.descriptionAr || p.description || "",
    floor: p.floor,
    total_floors: p.totalFloors,
    plot_sqm: p.plotSqm,
    furnishing: p.furnishing ? lower(p.furnishing) : null,
    ownership: p.ownershipType ? lower(p.ownershipType) : null,
    available_from: p.availableFrom?.toISOString() ?? null,
    handover: p.handover,
    developer: p.developer,
    year_built: p.yearBuilt,
    service_charge_sqm: p.serviceChargeSqm,
    location: {
      ...toCard(p, origin).location,
      address_en: [p.street, p.buildingName, p.area, p.city].filter(Boolean).join(", "),
      address_ar: [p.street, ar(p.buildingName), ar(p.area), ar(p.city)].filter(Boolean).join("، "),
      lat: p.latitude,
      lng: p.longitude,
    },
    amenities: amenityKeys(p),
    highlights: highlightKeys(p),
    nearby: nearby.map((n) => ({ category: n.category, name_en: n.nameEn, name_ar: n.nameAr || n.nameEn, minutes: n.minutes, mode: n.mode })),
    payment_plan: plan.map((m) => ({ key: m.key, percent: m.percent, timing_en: m.timingEn, timing_ar: m.timingAr || m.timingEn })),
    seo_title: p.seoTitle,
    seo_description: p.seoDescription,
    media: {
      videos: mediaRows.filter((m) => m.kind === "VIDEO").map(item),
      tours: mediaRows.filter((m) => m.kind === "VIRTUAL_TOUR").map(item),
      floor_plans: mediaRows.filter((m) => m.kind === "FLOOR_PLAN").map((m) => ({ ...item(m), is_pdf: isPdf(m) })),
      brochure: brochure ? { title: brochure.title, url: mediaUrl(brochure) } : null,
    },
    agent,
    market,
    similar,
  };
}

export type PublicListing = NonNullable<Awaited<ReturnType<typeof getPublicListing>>>;

/** Cards for a set of property ids (portal: saved homes, recommendations), public-safe. */
export async function publicCardsByIds(ids: string[], origin: string, includeUnpublished = false) {
  if (!ids.length) return new Map<string, PublicListingCard & { live: boolean }>();
  const rows = await db.property.findMany({ where: { id: { in: ids }, ...(includeUnpublished ? {} : publicWhere) }, select: { ...cardSelect, websitePublished: true } });
  return new Map(
    rows.map((r) => {
      const { websitePublished, ...row } = r;
      return [r.id, { ...toCard(row, origin), live: websitePublished && (PUBLIC_STATUSES as readonly string[]).includes(r.status) }] as const;
    }),
  );
}

export { toCard as toPublicCard, cardSelect as publicCardSelect };
