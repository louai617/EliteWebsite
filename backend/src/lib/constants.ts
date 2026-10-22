/**
 * Display metadata for every enum. Safe to import from client components
 * (the generated `enums` module is plain objects with no server code).
 */
import {
  CompletionStatus,
  OwnershipType,
  CustomerType,
  DealStatus,
  DealType,
  DocumentKind,
  Furnishing,
  LeadSource,
  LeadStatus,
  ExternalSource,
  ImportRecordStatus,
  ImportRunStatus,
  ListingPurpose,
  PassRequestStatus,
  PoolLeadStatus,
  PaymentMethod,
  Priority,
  PropertyCategory,
  PropertyStatus,
  PropertySubcategory,
  PropertyType,
  ReservationStatus,
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
  LEADS_POOL: "Leads pool",
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
  PENDING_CONTRACT: { label: "Pending contract", tone: "amber" },
  CLOSED: { label: "Closed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "red" },
};

export const OPEN_DEAL_STATUSES: DealStatus[] = [DealStatus.PENDING_CONTRACT];

export const DOCUMENT_KIND_META: MetaMap<DocumentKind> = {
  VIEWING_FORM: { label: "Viewing form", tone: "amber" },
  BOOKING_FORM: { label: "Booking form", tone: "violet" },
  PROOF_OF_PAYMENT: { label: "Proof of payment", tone: "green" },
  QID: { label: "QID", tone: "blue" },
  PASSPORT: { label: "Passport", tone: "blue" },
  VISA: { label: "Visa / residence permit", tone: "teal" },
  TRADE_LICENSE: { label: "Trade licence (CR)", tone: "slate" },
  CONTRACT: { label: "Signed contract", tone: "gold" },
  OTHER: { label: "Other", tone: "neutral" },
};

/** Identity documents kept on the client's file. */
export const CLIENT_DOCUMENT_KINDS: DocumentKind[] = ["QID", "PASSPORT", "VISA", "TRADE_LICENSE", "CONTRACT", "BOOKING_FORM", "PROOF_OF_PAYMENT", "OTHER"];
export const LEAD_DOCUMENT_KINDS: DocumentKind[] = ["VIEWING_FORM", "BOOKING_FORM", "PROOF_OF_PAYMENT", "QID", "PASSPORT", "OTHER"];

export const PASS_STATUS_META: MetaMap<PassRequestStatus> = {
  PENDING: { label: "Waiting for approval", tone: "amber" },
  APPROVED: { label: "Approved", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
};

export const POOL_LEAD_STATUS_META: MetaMap<PoolLeadStatus> = {
  AVAILABLE: { label: "In the pool", tone: "blue" },
  TAKEN: { label: "Taken", tone: "green" },
};

export const POOL_REQUEST_STATUS_META: MetaMap<PassRequestStatus> = {
  PENDING: { label: "Waiting for approval", tone: "amber" },
  APPROVED: { label: "Approved", tone: "green" },
  REJECTED: { label: "Not approved", tone: "red" },
};

export const RESERVATION_STATUS_META: MetaMap<ReservationStatus> = {
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "amber" },
  PAYMENT_SUBMITTED: { label: "Payment to verify", tone: "blue" },
  CONFIRMED: { label: "Confirmed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
};

export const PAYMENT_METHOD_META: MetaMap<PaymentMethod> = {
  FAWRAN: { label: "Fawran / bank transfer", tone: "teal" },
  CARD: { label: "Card (coming soon)", tone: "neutral" },
};

/** Common reasons offered when a lead is marked Lost (the agent can also write their own). */
export const LOST_REASONS = [
  "Budget doesn't match",
  "Bought / rented elsewhere",
  "Not responding",
  "No suitable property",
  "Changed plans",
  "Duplicate lead",
] as const;

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

// ───────────── Public website vocabulary (keys match the website's translations) ─────────────

/** Amenity flag → website amenity key, so flags show up on the website automatically. */
export const AMENITY_FLAG_WEBSITE_KEY: Partial<Record<AmenityKey, string>> = {
  hasBalcony: "balcony",
  hasMaidRoom: "maid_room",
  hasPool: "shared_pool",
  hasGym: "shared_gym",
  hasSeaView: "sea_view",
  hasGarden: "private_garden",
  hasBbq: "barbecue_area",
  hasSecurity: "security",
  hasCentralAc: "central_ac",
};

/** Website amenities not covered by the flags above. */
export const EXTRA_AMENITIES = [
  { value: "built_in_wardrobes", label: "Built-in wardrobes" },
  { value: "walk_in_closet", label: "Walk-in closet" },
  { value: "covered_parking", label: "Covered parking" },
  { value: "private_pool", label: "Private pool" },
  { value: "concierge", label: "Concierge" },
  { value: "kitchen_appliances", label: "Kitchen appliances" },
  { value: "pets_allowed", label: "Pets allowed" },
  { value: "beach_access", label: "Beach access" },
  { value: "study", label: "Study" },
  { value: "private_lift", label: "Private lift" },
  { value: "cinema_room", label: "Cinema room" },
] as const;

export const HIGHLIGHTS = [
  { value: "corner_unit", label: "Corner unit" },
  { value: "marina_view", label: "Marina view" },
  { value: "upper_floor", label: "Upper floor" },
  { value: "title_deed", label: "Title deed ready" },
  { value: "corner_plot", label: "Corner plot" },
  { value: "brand_new", label: "Brand new" },
  { value: "private_pool_hl", label: "Private pool" },
  { value: "full_floor", label: "Full floor" },
  { value: "payment_plan_hl", label: "Payment plan" },
  { value: "private_lift_hl", label: "Private lift" },
] as const;

export const NEARBY_CATEGORIES = [
  { value: "school", label: "School" },
  { value: "mall", label: "Mall" },
  { value: "beach", label: "Beach" },
  { value: "airport", label: "Airport" },
  { value: "hospital", label: "Hospital" },
  { value: "metro", label: "Metro" },
  { value: "landmark", label: "Landmark" },
] as const;

export const PAYMENT_MILESTONES = [
  { value: "booking", label: "On booking" },
  { value: "construction", label: "During construction" },
  { value: "handover", label: "On handover" },
  { value: "post_handover", label: "Post-handover" },
] as const;

export const COMPLETION_META: MetaMap<CompletionStatus> = {
  READY: { label: "Ready", tone: "green" },
  OFF_PLAN: { label: "Off-plan", tone: "amber" },
};

export const OWNERSHIP_META = labelsOnly<OwnershipType>({ FREEHOLD: "Freehold", LEASEHOLD: "Leasehold", USUFRUCT: "Usufruct" });

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

/** Arabic names for areas/cities shown on the bilingual website (falls back to English). */
export const AREA_NAMES_AR: Record<string, string> = {
  Doha: "الدوحة",
  Qatar: "قطر",
  "The Pearl": "اللؤلؤة",
  "The Pearl-Qatar": "اللؤلؤة",
  "Porto Arabia": "بورتو أرابيا",
  "Qanat Quartier": "قناة كوارتيير",
  Lusail: "لوسيل",
  "Lusail City": "مدينة لوسيل",
  "West Bay": "الخليج الغربي",
  "West Bay Lagoon": "لاغونا الخليج الغربي",
  Msheireb: "مشيرب",
  "Al Sadd": "السد",
  "Al Nasr": "النصر",
  "Al Waab": "الوعب",
  "Ain Khaled": "عين خالد",
  "Old Airport": "المطار القديم",
  "Al Dafna": "الدفنة",
  "Al Hilal": "الهلال",
  "Al Mansoura": "المنصورة",
  "Bin Mahmoud": "بن محمود",
  "Fereej Bin Omran": "فريج بن عمران",
  "Al Gharrafa": "الغرافة",
  "Al Rayyan": "الريان",
  "Madinat Khalifa": "مدينة خليفة",
  "Umm Salal": "أم صلال",
  "Al Wakrah": "الوكرة",
  "Al Khor": "الخور",
  "Salwa Road": "طريق سلوى",
  "Al Duhail": "الدحيل",
  "Al Thumama": "الثمامة",
  "Al Aziziya": "العزيزية",
  "Al Muntazah": "المنتزه",
  "Al Kheesa": "الخيسة",
};
