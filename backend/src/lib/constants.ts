/**
 * Display metadata for every enum. Safe to import from client components
 * (the generated `enums` module is plain objects with no server code).
 */
import {
  CustomerType,
  DealStatus,
  DealType,
  Furnishing,
  LeadSource,
  LeadStatus,
  ExternalSource,
  ImportRecordStatus,
  ImportRunStatus,
  ListingPurpose,
  Priority,
  PropertyCategory,
  PropertyStatus,
  PropertySubcategory,
  PropertyType,
  Role,
  TaskStatus,
  TaskType,
  ViewingStatus,
  WorkActivityType,
} from "@/generated/prisma/enums";

export type Tone = "neutral" | "blue" | "violet" | "amber" | "green" | "red" | "gold" | "slate" | "teal";

export interface EnumMeta {
  label: string;
  tone: Tone;
}

type MetaMap<T extends string> = Record<T, EnumMeta>;

function labelsOnly<T extends string>(labels: Record<T, string>): MetaMap<T> {
  return Object.fromEntries(Object.entries(labels).map(([k, label]) => [k, { label, tone: "neutral" }])) as MetaMap<T>;
}

export const ROLE_META: MetaMap<Role> = {
  ADMIN: { label: "Admin", tone: "gold" },
  MANAGER: { label: "Manager", tone: "violet" },
  AGENT: { label: "Agent", tone: "blue" },
  CLIENT: { label: "Client", tone: "teal" },
};

/** Roles that work inside the CRM (everything except client-portal accounts). */
export const STAFF_ROLES: Role[] = [Role.ADMIN, Role.MANAGER, Role.AGENT];

export const PROPERTY_TYPE_META = labelsOnly<PropertyType>({
  APARTMENT: "Apartment",
  VILLA: "Villa",
  TOWNHOUSE: "Townhouse",
  PENTHOUSE: "Penthouse",
  STUDIO: "Studio",
  DUPLEX: "Duplex",
  COMPOUND_VILLA: "Compound villa",
  OFFICE: "Office",
  SHOP: "Shop",
  WAREHOUSE: "Warehouse",
  LAND: "Land",
  BUILDING: "Whole building",
});

// ─── Property hierarchy ───
//
// PROPERTY
// ├── Residential ── Company | Private
// └── Commercial  ── Company | Private
//
// The hierarchy is defined once here (from the database enums) and drives the sidebar, the
// filters, the forms and the API, so adding a level or a value is a one-place change.

export const PROPERTY_CATEGORY_META: MetaMap<PropertyCategory> = {
  RESIDENTIAL: { label: "Residential", tone: "teal" },
  COMMERCIAL: { label: "Commercial", tone: "violet" },
};

export const PROPERTY_SUBCATEGORY_META: MetaMap<PropertySubcategory> = {
  COMPANY: { label: "Company", tone: "gold" },
  PRIVATE: { label: "Private", tone: "slate" },
};

/** Which property types belong to which category (Land and whole buildings can be either). */
export const PROPERTY_TYPES_BY_CATEGORY: Record<PropertyCategory, PropertyType[]> = {
  RESIDENTIAL: [
    PropertyType.APARTMENT,
    PropertyType.VILLA,
    PropertyType.TOWNHOUSE,
    PropertyType.PENTHOUSE,
    PropertyType.STUDIO,
    PropertyType.DUPLEX,
    PropertyType.COMPOUND_VILLA,
    PropertyType.LAND,
    PropertyType.BUILDING,
  ],
  COMMERCIAL: [PropertyType.OFFICE, PropertyType.SHOP, PropertyType.WAREHOUSE, PropertyType.LAND, PropertyType.BUILDING],
};

/** Default category for a type (used when importing / migrating data). */
export function categoryForType(type: PropertyType): PropertyCategory {
  return PROPERTY_TYPES_BY_CATEGORY.COMMERCIAL.includes(type) && !PROPERTY_TYPES_BY_CATEGORY.RESIDENTIAL.includes(type)
    ? PropertyCategory.COMMERCIAL
    : PropertyCategory.RESIDENTIAL;
}

export interface PropertyHierarchyNode {
  category: PropertyCategory;
  label: string;
  subcategories: { subcategory: PropertySubcategory; label: string }[];
}

export const PROPERTY_HIERARCHY: PropertyHierarchyNode[] = (Object.keys(PROPERTY_CATEGORY_META) as PropertyCategory[]).map((category) => ({
  category,
  label: PROPERTY_CATEGORY_META[category].label,
  subcategories: (Object.keys(PROPERTY_SUBCATEGORY_META) as PropertySubcategory[]).map((subcategory) => ({
    subcategory,
    label: PROPERTY_SUBCATEGORY_META[subcategory].label,
  })),
}));

/** "Residential · Company" */
export function propertyClassLabel(category: PropertyCategory, subcategory: PropertySubcategory) {
  return `${PROPERTY_CATEGORY_META[category].label} · ${PROPERTY_SUBCATEGORY_META[subcategory].label}`;
}

export const PURPOSE_META: MetaMap<ListingPurpose> = {
  RENT: { label: "Rent", tone: "teal" },
  SALE: { label: "Sale", tone: "violet" },
};

export const PROPERTY_STATUS_META: MetaMap<PropertyStatus> = {
  AVAILABLE: { label: "Available", tone: "green" },
  RESERVED: { label: "Reserved", tone: "amber" },
  RENTED: { label: "Rented", tone: "blue" },
  SOLD: { label: "Sold", tone: "violet" },
  OFF_MARKET: { label: "Off market", tone: "slate" },
};

export const FURNISHING_META = labelsOnly<Furnishing>({
  FURNISHED: "Furnished",
  SEMI_FURNISHED: "Semi furnished",
  UNFURNISHED: "Unfurnished",
});

export const LEAD_SOURCE_META = labelsOnly<LeadSource>({
  PROPERTY_FINDER: "Property Finder",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Referral",
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  OTHER: "Other",
});

export const LEAD_STATUS_META: MetaMap<LeadStatus> = {
  NEW: { label: "New", tone: "blue" },
  CONTACTED: { label: "Contacted", tone: "teal" },
  QUALIFIED: { label: "Qualified", tone: "violet" },
  VIEWING_SCHEDULED: { label: "Viewing", tone: "amber" },
  NEGOTIATION: { label: "Negotiation", tone: "gold" },
  WON: { label: "Won", tone: "green" },
  LOST: { label: "Lost", tone: "red" },
};

/** Pipeline column order for the Kanban board. */
export const LEAD_PIPELINE: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.VIEWING_SCHEDULED,
  LeadStatus.NEGOTIATION,
  LeadStatus.WON,
  LeadStatus.LOST,
];

export const PRIORITY_META: MetaMap<Priority> = {
  LOW: { label: "Low", tone: "slate" },
  MEDIUM: { label: "Medium", tone: "blue" },
  HIGH: { label: "High", tone: "amber" },
  URGENT: { label: "Urgent", tone: "red" },
};

export const CUSTOMER_TYPE_META = labelsOnly<CustomerType>({
  BUYER: "Buyer",
  TENANT: "Tenant",
  INVESTOR: "Investor",
  LANDLORD: "Landlord",
  SELLER: "Seller",
});

export const VIEWING_STATUS_META: MetaMap<ViewingStatus> = {
  SCHEDULED: { label: "Scheduled", tone: "blue" },
  CONFIRMED: { label: "Confirmed", tone: "teal" },
  COMPLETED: { label: "Completed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
  NO_SHOW: { label: "No show", tone: "red" },
};

export const DEAL_TYPE_META: MetaMap<DealType> = {
  SALE: { label: "Sale", tone: "violet" },
  RENTAL: { label: "Rental", tone: "teal" },
};

export const DEAL_STATUS_META: MetaMap<DealStatus> = {
  NEGOTIATION: { label: "Negotiation", tone: "amber" },
  CONTRACT_PENDING: { label: "Contract pending", tone: "blue" },
  CONTRACT_SIGNED: { label: "Contract signed", tone: "violet" },
  CLOSED_WON: { label: "Closed won", tone: "green" },
  CLOSED_LOST: { label: "Closed lost", tone: "red" },
};

export const OPEN_DEAL_STATUSES: DealStatus[] = [
  DealStatus.NEGOTIATION,
  DealStatus.CONTRACT_PENDING,
  DealStatus.CONTRACT_SIGNED,
];

export const TASK_STATUS_META: MetaMap<TaskStatus> = {
  TODO: { label: "To do", tone: "slate" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  COMPLETED: { label: "Completed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const TASK_TYPE_META: MetaMap<TaskType> = {
  GENERAL: { label: "General", tone: "neutral" },
  PROPERTY_POSTING: { label: "Post property", tone: "violet" },
  PROPERTY_REPOST: { label: "Repost property", tone: "violet" },
  NEW_LISTING: { label: "New listing", tone: "gold" },
  CALL: { label: "Phone call", tone: "blue" },
  LEAD_RESPONSE: { label: "Lead response", tone: "red" },
  LEAD_FOLLOW_UP: { label: "Lead follow-up", tone: "amber" },
  LEAD_QUALIFICATION: { label: "Lead qualification", tone: "teal" },
  VIEWING: { label: "Viewing", tone: "green" },
  CLIENT_FOLLOW_UP: { label: "Client follow-up", tone: "amber" },
};

export const WORK_ACTIVITY_META: MetaMap<WorkActivityType> = {
  CALL: { label: "Call", tone: "blue" },
  LEAD_RESPONSE: { label: "Lead answered", tone: "red" },
  FOLLOW_UP: { label: "Lead follow-up", tone: "amber" },
  CLIENT_FOLLOW_UP: { label: "Client follow-up", tone: "amber" },
  LEAD_QUALIFICATION: { label: "Lead qualified", tone: "teal" },
  PROPERTY_POST: { label: "Property posted", tone: "violet" },
  PROPERTY_REPOST: { label: "Property reposted", tone: "violet" },
  NEW_LISTING: { label: "New listing", tone: "gold" },
  VIEWING: { label: "Viewing completed", tone: "green" },
  CONVERSION: { label: "Conversion", tone: "green" },
  OTHER: { label: "Other", tone: "neutral" },
};

/** When a task of this type is completed, this activity is recorded for the assignee. */
export const TASK_TYPE_ACTIVITY: Partial<Record<TaskType, WorkActivityType>> = {
  PROPERTY_POSTING: WorkActivityType.PROPERTY_POST,
  PROPERTY_REPOST: WorkActivityType.PROPERTY_REPOST,
  NEW_LISTING: WorkActivityType.NEW_LISTING,
  CALL: WorkActivityType.CALL,
  LEAD_RESPONSE: WorkActivityType.LEAD_RESPONSE,
  LEAD_FOLLOW_UP: WorkActivityType.FOLLOW_UP,
  LEAD_QUALIFICATION: WorkActivityType.LEAD_QUALIFICATION,
  VIEWING: WorkActivityType.VIEWING,
  CLIENT_FOLLOW_UP: WorkActivityType.CLIENT_FOLLOW_UP,
};

export const EXTERNAL_SOURCE_META: MetaMap<ExternalSource> = {
  PROPERTY_FINDER: { label: "Property Finder", tone: "red" },
  QATAR_LIVING: { label: "Qatar Living", tone: "blue" },
};

export const IMPORT_RUN_STATUS_META: MetaMap<ImportRunStatus> = {
  RUNNING: { label: "Running", tone: "blue" },
  COMPLETED: { label: "Completed", tone: "green" },
  COMPLETED_WITH_ERRORS: { label: "Completed with errors", tone: "amber" },
  FAILED: { label: "Failed", tone: "red" },
};

export const IMPORT_RECORD_STATUS_META: MetaMap<ImportRecordStatus> = {
  CREATED: { label: "Created", tone: "green" },
  UPDATED: { label: "Updated", tone: "blue" },
  UNCHANGED: { label: "Unchanged", tone: "slate" },
  SKIPPED: { label: "Skipped", tone: "amber" },
  FAILED: { label: "Failed", tone: "red" },
};

export const OPEN_TASK_STATUSES: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS];

/** Boolean amenity columns on Property, in display order. */
export const AMENITIES = [
  { key: "hasBalcony", label: "Balcony" },
  { key: "hasMaidRoom", label: "Maid room" },
  { key: "hasPool", label: "Pool" },
  { key: "hasGym", label: "Gym" },
  { key: "hasSeaView", label: "Sea view" },
  { key: "hasMarinaView", label: "Marina view" },
  { key: "hasGarden", label: "Garden" },
  { key: "hasBbq", label: "BBQ area" },
  { key: "hasSecurity", label: "24h security" },
  { key: "hasCentralAc", label: "Central A/C" },
  { key: "hasInternet", label: "Internet" },
  { key: "billsIncluded", label: "Bills included" },
] as const;

export type AmenityKey = (typeof AMENITIES)[number]["key"];

/** Suggested Doha districts (free text is still allowed). */
export const QATAR_AREAS = [
  "The Pearl",
  "Lusail",
  "West Bay",
  "Msheireb",
  "Al Sadd",
  "Al Nasr",
  "Al Waab",
  "Ain Khaled",
  "Old Airport",
  "Al Dafna",
  "Al Hilal",
  "Al Mansoura",
  "Bin Mahmoud",
  "Fereej Bin Omran",
  "Al Gharrafa",
  "Al Rayyan",
  "Madinat Khalifa",
  "Umm Salal",
  "Al Wakrah",
  "Al Khor",
] as const;

export function options<T extends string>(meta: MetaMap<T>) {
  return (Object.keys(meta) as T[]).map((value) => ({ value, label: meta[value].label }));
}

export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;
