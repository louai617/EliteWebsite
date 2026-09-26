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
  ListingPurpose,
  Priority,
  PropertyStatus,
  PropertyType,
  Role,
  TaskStatus,
  ViewingStatus,
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
};

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
