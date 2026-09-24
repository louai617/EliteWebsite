/**
 * Fixed CRM vocabulary shared by the API, the database models and the UI.
 *
 * Anything a business might reasonably want to rename or extend (lead statuses,
 * lead sources, locations, property types) is NOT here — it lives in the
 * `settings` collection and is edited from Dashboard → Settings. The defaults
 * seeded into that collection are at the bottom of this file.
 */

export const ROLES = ['admin', 'manager', 'broker', 'staff', 'user'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that work inside the CRM dashboard. `user` is a public-site customer. */
export const STAFF_ROLES: readonly Role[] = ['admin', 'manager', 'broker', 'staff'];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  broker: 'Broker / Agent',
  staff: 'Staff',
  user: 'Customer',
};

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PURPOSES = ['sale', 'rent'] as const;
export type PurposeValue = (typeof PURPOSES)[number];

export const FURNISHING = ['furnished', 'semi_furnished', 'unfurnished'] as const;
export const COMPLETION = ['ready', 'offplan'] as const;
export const OWNERSHIP = ['freehold', 'leasehold', 'usufruct'] as const;
export const PRICE_FREQUENCIES = ['year', 'month'] as const;

/** Where a property is in its transaction lifecycle (independent of whether it is published). */
export const PROPERTY_STATUSES = [
  'available',
  'reserved',
  'under_offer',
  'rented',
  'sold',
  'off_market',
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const CLIENT_TYPES = ['tenant', 'buyer', 'landlord', 'seller', 'investor'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const VIEWING_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export type ViewingStatus = (typeof VIEWING_STATUSES)[number];

export const DEAL_TYPES = ['sale', 'rental'] as const;
export const DEAL_STATUSES = ['negotiation', 'reserved', 'contracted', 'completed', 'cancelled'] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const TASK_TYPES = ['call', 'whatsapp', 'email', 'viewing', 'follow_up', 'meeting', 'other'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const LANGUAGES = ['en', 'ar', 'fr', 'hi'] as const;

/** Amenity keys the public site can translate (see `property.amenity_*` in locales). */
export const AMENITIES = [
  'balcony', 'built_in_wardrobes', 'central_ac', 'covered_parking', 'shared_pool',
  'private_pool', 'private_garden', 'security', 'concierge', 'shared_gym',
  'walk_in_closet', 'maid_room', 'sea_view', 'kitchen_appliances', 'pets_allowed',
  'beach_access', 'study', 'barbecue_area', 'private_lift', 'cinema_room',
] as const;

/**
 * Hosts allowed for listing images and profile photos. Must match
 * `images.remotePatterns` in next.config.mjs — next/image refuses any other
 * host. Add a host in both places to allow it.
 */
export const IMAGE_HOSTS = ['images.unsplash.com', 'res.cloudinary.com'] as const;

/** Human label for any snake_case key: `viewing_scheduled` → `Viewing Scheduled`. */
export function humanize(key: string | null | undefined): string {
  if (!key) return '';
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Settings defaults (seeded once; editable afterwards)
// ---------------------------------------------------------------------------

/** `open` counts as an active lead, `won` as converted, `lost` as closed-lost. */
export const LEAD_STATUS_CATEGORIES = ['open', 'won', 'lost'] as const;
export type LeadStatusCategory = (typeof LEAD_STATUS_CATEGORIES)[number];

export interface LeadStatusOption {
  key: string;
  label: string;
  category: LeadStatusCategory;
  color: string;
}

export interface SimpleOption {
  key: string;
  label: string;
}

export interface LocationOption {
  key: string;
  name_en: string;
  name_ar: string;
  city_en: string;
  city_ar: string;
}

export interface PropertyTypeOption {
  key: string;
  label_en: string;
  label_ar: string;
}

export const DEFAULT_LEAD_STATUSES: LeadStatusOption[] = [
  { key: 'new', label: 'New', category: 'open', color: 'blue' },
  { key: 'contacted', label: 'Contacted', category: 'open', color: 'orange' },
  { key: 'qualified', label: 'Qualified', category: 'open', color: 'green' },
  { key: 'viewing_scheduled', label: 'Viewing Scheduled', category: 'open', color: 'purple' },
  { key: 'negotiation', label: 'Negotiation', category: 'open', color: 'amber' },
  { key: 'won', label: 'Won', category: 'won', color: 'emerald' },
  { key: 'lost', label: 'Lost', category: 'lost', color: 'red' },
];

export const DEFAULT_LEAD_SOURCES: SimpleOption[] = [
  { key: 'website_form', label: 'Website Form' },
  { key: 'chatbot', label: 'Chatbot' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'call', label: 'Phone Call' },
  { key: 'walk_in', label: 'Walk-in' },
  { key: 'referral', label: 'Referral' },
  { key: 'property_finder', label: 'Property Finder' },
  { key: 'social_media', label: 'Social Media' },
  { key: 'other', label: 'Other' },
];

const doha = { city_en: 'Doha', city_ar: 'الدوحة' };
const lusailCity = { city_en: 'Lusail', city_ar: 'لوسيل' };

export const DEFAULT_LOCATIONS: LocationOption[] = [
  { key: 'the_pearl', name_en: 'The Pearl', name_ar: 'اللؤلؤة', ...doha },
  { key: 'porto_arabia', name_en: 'Porto Arabia', name_ar: 'بورتو أرابيا', ...doha },
  { key: 'lusail', name_en: 'Lusail', name_ar: 'لوسيل', ...lusailCity },
  { key: 'west_bay', name_en: 'West Bay', name_ar: 'الخليج الغربي', ...doha },
  { key: 'west_bay_lagoon', name_en: 'West Bay Lagoon', name_ar: 'لاجونا الخليج الغربي', ...doha },
  { key: 'al_sadd', name_en: 'Al Sadd', name_ar: 'السد', ...doha },
  { key: 'al_nasr', name_en: 'Al Nasr', name_ar: 'النصر', ...doha },
  { key: 'ain_khaled', name_en: 'Ain Khaled', name_ar: 'عين خالد', ...doha },
  { key: 'msheireb', name_en: 'Msheireb', name_ar: 'مشيرب', ...doha },
  { key: 'al_waab', name_en: 'Al Waab', name_ar: 'الوعب', ...doha },
  { key: 'al_duhail', name_en: 'Al Duhail', name_ar: 'الدحيل', ...doha },
  { key: 'al_gharrafa', name_en: 'Al Gharrafa', name_ar: 'الغرافة', city_en: 'Al Rayyan', city_ar: 'الريان' },
];

export const DEFAULT_PROPERTY_TYPES: PropertyTypeOption[] = [
  { key: 'apartment', label_en: 'Apartment', label_ar: 'شقة' },
  { key: 'villa', label_en: 'Villa', label_ar: 'فيلا' },
  { key: 'penthouse', label_en: 'Penthouse', label_ar: 'بنتهاوس' },
  { key: 'studio', label_en: 'Studio', label_ar: 'استوديو' },
  { key: 'townhouse', label_en: 'Townhouse', label_ar: 'تاون هاوس' },
  { key: 'compound', label_en: 'Compound', label_ar: 'مجمع سكني' },
  { key: 'office', label_en: 'Office', label_ar: 'مكتب' },
  { key: 'retail', label_en: 'Retail', label_ar: 'محل تجاري' },
  { key: 'land', label_en: 'Land', label_ar: 'أرض' },
];
