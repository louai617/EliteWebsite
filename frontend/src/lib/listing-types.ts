/** Listing shapes returned by the CRM's public API (client-safe: types and pure helpers only). */

export interface PricePoint {
  label: string;
  community: number;
  city: number;
}

export interface NearbyPlace {
  category: 'school' | 'mall' | 'beach' | 'airport' | 'hospital' | 'metro' | 'landmark';
  name_en: string;
  name_ar: string;
  minutes: number;
  mode: 'drive' | 'walk';
}

export interface PaymentMilestone {
  key: 'booking' | 'construction' | 'handover' | 'post_handover';
  percent: number;
  timing_en: string;
  timing_ar: string;
}

export interface ListingAgent {
  name: string;
  title: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  photo: string | null;
  response_minutes: number | null;
  listings_count: number;
  is_superagent: boolean;
  agency_name_en: string;
  agency_name_ar: string;
  agency_listings: number;
  verified_agents: number;
}

export interface ListingCard {
  /** The CRM reference, also used in URLs (e.g. ELT-1031). */
  _id: string;
  reference_number: string;
  title_en: string;
  title_ar: string;
  type: string;
  category: 'residential' | 'commercial';
  listed_by: 'company' | 'private';
  purpose: 'sale' | 'rent';
  status: 'available' | 'reserved';
  price: number;
  currency: string;
  price_frequency?: 'month' | 'year';
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  parking: number;
  completion: 'ready' | 'offplan';
  location: { city_en: string; city_ar: string; area_en: string; area_ar: string; community_en: string; community_ar: string };
  images: string[];
  is_featured: boolean;
  is_verified: boolean;
  is_exclusive: boolean;
  listed_at: string;
  listed_days_ago: number;
}

export interface Listing extends ListingCard {
  id: string;
  description_en: string;
  description_ar: string;
  floor: number | null;
  total_floors: number | null;
  plot_sqm: number | null;
  furnishing: 'furnished' | 'semi_furnished' | 'unfurnished' | null;
  ownership: 'freehold' | 'leasehold' | 'usufruct' | null;
  available_from: string | null;
  handover: string | null;
  developer: string | null;
  year_built: number | null;
  service_charge_sqm: number | null;
  location: ListingCard['location'] & { address_en: string; address_ar: string; lat: number | null; lng: number | null };
  amenities: string[];
  highlights: string[];
  nearby: NearbyPlace[];
  payment_plan: PaymentMilestone[];
  seo_title: string | null;
  seo_description: string | null;
  agent: ListingAgent;
  market: {
    avg_price: number;
    avg_size_sqm: number | null;
    comparable_count: number;
    community_listings: number;
    community_buildings: number;
    price_history: PricePoint[];
  } | null;
  similar: ListingCard[];
}

export interface ListingPage {
  items: ListingCard[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: { areas: { value: string; label_en: string; label_ar: string; count: number }[] };
}

export interface ListingQuery {
  q?: string;
  purpose?: string;
  category?: string;
  type?: string;
  area?: string;
  beds?: string | number;
  priceMin?: string | number;
  priceMax?: string | number;
  featured?: boolean;
  sort?: string;
  page?: string | number;
  pageSize?: number;
}

/** Price per m², annualised for rentals so it can be compared with the market series. */
export function pricePerSqm(listing: Pick<ListingCard, 'price' | 'price_frequency' | 'area_sqm'>): number | null {
  if (!listing.area_sqm) return null;
  const annual = listing.price_frequency === 'month' ? listing.price * 12 : listing.price;
  return Math.round(annual / listing.area_sqm);
}

/** Percentage difference vs the community average. Positive means above average. */
export function deltaPercent(value: number | null, average: number | null | undefined): number | null {
  if (!value || !average) return null;
  return Math.round(((value - average) / average) * 100);
}
