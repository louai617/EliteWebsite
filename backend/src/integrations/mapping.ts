import type { Furnishing, ListingPurpose, PropertyCategory, PropertyType } from "@/generated/prisma/enums";
import { categoryForType } from "@/lib/constants";
import { ListingError, type Contact } from "./types";

/**
 * Field coercion and category mapping shared by every adapter. Portals send numbers as
 * strings, booleans as "Yes"/"1", nested objects or flat keys — these helpers absorb that.
 */

export type Raw = Record<string, unknown>;

export function asRecord(value: unknown): Raw {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Raw;
  throw new ListingError("Record is not an object");
}

/** First non-empty value among several possible keys (supports dotted paths). */
export function pick(raw: Raw, ...keys: string[]): unknown {
  for (const key of keys) {
    let value: unknown = raw;
    for (const part of key.split(".")) value = value && typeof value === "object" ? (value as Raw)[part] : undefined;
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function str(value: unknown, max = 20_000): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") {
    // Multi-language objects ({ en: "...", ar: "..." }) or { value: "..." }.
    const v = value as Raw;
    return str(v.en ?? v.value ?? v.text ?? null, max);
  }
  const s = String(value).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

/** Keeps line breaks (descriptions). */
export function longText(value: unknown, max = 20_000): string | null {
  if (value && typeof value === "object") return longText((value as Raw).en ?? (value as Raw).value ?? null, max);
  if (value === undefined || value === null) return null;
  const s = String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  return s ? s.slice(0, max) : null;
}

export function num(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[,\s]/g, "").replace(/[^0-9.+-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function int(value: unknown): number | null {
  if (typeof value === "string" && /^studio$/i.test(value.trim())) return 0;
  const n = num(value);
  return n === null ? null : Math.round(n);
}

export function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return /^(1|y|yes|true|on)$/i.test(String(value ?? "").trim());
}

export function list(value: unknown): unknown[] {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(/[,|;]/).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "object") {
    // XML-to-JSON converters often produce { url: [...] } or { item: [...] }.
    const v = value as Raw;
    const inner = v.url ?? v.item ?? v.image ?? v.photo;
    if (inner !== undefined) return list(inner);
    return [value];
  }
  return [value];
}

export function isoDate(value: unknown): string | null {
  const s = str(value, 64);
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const SQFT_TO_SQM = 0.092903;

/** Area in m²; `unit` may say sqft. */
export function areaSqm(value: unknown, unit?: unknown): number | null {
  const n = num(value);
  if (n === null || n <= 0) return null;
  const sqft = /ft|feet/i.test(String(unit ?? "")) || /ft|feet/i.test(String(value));
  return Math.round((sqft ? n * SQFT_TO_SQM : n) * 10) / 10;
}

export function purposeFrom(value: unknown): ListingPurpose | null {
  const s = String(value ?? "").toLowerCase();
  if (/rent|lease|^let$|^r$|^(rr|cr)$/.test(s)) return "RENT";
  if (/sale|sell|buy|^s$|^(rs|cs)$/.test(s)) return "SALE";
  return null;
}

/** Free-text / portal codes → CRM property type. Unknown types fail the record rather than guess. */
const TYPE_PATTERNS: [RegExp, PropertyType][] = [
  [/penthouse|^ph$/i, "PENTHOUSE"],
  [/duplex|^dx$/i, "DUPLEX"],
  [/compound/i, "COMPOUND_VILLA"],
  [/town ?house|^th$/i, "TOWNHOUSE"],
  [/villa|^vh$|^vi$/i, "VILLA"],
  [/studio|^st$/i, "STUDIO"],
  [/hotel apartment|apartment|flat|^ap$|^ha$/i, "APARTMENT"],
  [/office|^of$|^co$|business cent/i, "OFFICE"],
  [/shop|retail|showroom|^sh$|^rt$|^sr$/i, "SHOP"],
  [/warehouse|labou?r camp|factory|storage|^wh$|^fa$/i, "WAREHOUSE"],
  [/land|plot|^lp$/i, "LAND"],
  [/building|^bu$|whole building/i, "BUILDING"],
];

export function propertyTypeFrom(value: unknown): PropertyType | null {
  const s = str(value, 80);
  if (!s) return null;
  for (const [re, type] of TYPE_PATTERNS) if (re.test(s)) return type;
  return null;
}

/** Explicit residential/commercial wins; otherwise the type decides (Land/Building default to residential). */
export function categoryFrom(value: unknown, type: PropertyType): PropertyCategory {
  const s = String(value ?? "").toLowerCase();
  if (/commercial|^c[sr]$/.test(s)) return "COMMERCIAL";
  if (/residential|^r[sr]$/.test(s)) return "RESIDENTIAL";
  return categoryForType(type);
}

export function furnishingFrom(value: unknown): Furnishing | null {
  const s = String(value ?? "").toLowerCase().trim();
  if (!s) return null;
  if (/semi|part/.test(s)) return "SEMI_FURNISHED";
  if (/^(no|n|false|0)$|un-?furnished|not furnished/.test(s)) return "UNFURNISHED";
  if (/^(yes|y|true|1)$|furnished/.test(s)) return "FURNISHED";
  return null;
}

export function contactFrom(value: unknown, fallback: Raw = {}): Contact | null {
  const v = value && typeof value === "object" ? (value as Raw) : {};
  const email = str(pick(v, "email", "email_address") ?? fallback.email, 200)?.toLowerCase() ?? null;
  const contact: Contact = {
    name: str(pick(v, "name", "full_name", "fullName") ?? fallback.name, 160),
    phone: str(pick(v, "phone", "mobile", "phone_number", "cell") ?? fallback.phone, 40),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    company: str(pick(v, "company", "agency", "company_name", "broker") ?? fallback.company, 160),
  };
  return contact.name || contact.phone || contact.email ? contact : null;
}

export function imageUrls(value: unknown): string[] {
  const out: string[] = [];
  for (const item of list(value)) {
    const u = typeof item === "string" ? item : str(pick(asRecordOrEmpty(item), "url", "src", "href", "original", "link"), 2000);
    if (u && /^https?:\/\//i.test(u.trim()) && !out.includes(u.trim())) out.push(u.trim());
  }
  return out.slice(0, 50);
}

function asRecordOrEmpty(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}

/** Amenity names/codes → the CRM's boolean amenity columns. */
const AMENITY_FLAGS: [RegExp, AmenityFlag][] = [
  [/balcon|^ba$/i, "hasBalcony"],
  [/maid|^ms$/i, "hasMaidRoom"],
  [/pool|^pp$|^sp$/i, "hasPool"],
  [/gym|fitness|^pg$|^sg$/i, "hasGym"],
  [/sea view|^vw$|^sv$/i, "hasSeaView"],
  [/marina/i, "hasMarinaView"],
  [/garden|^pa$|^sa$/i, "hasGarden"],
  [/bbq|barbecue/i, "hasBbq"],
  [/security|^sy$|^cs$/i, "hasSecurity"],
  [/central a\/?c|central air|^ac$/i, "hasCentralAc"],
  [/internet|wi-?fi|broadband/i, "hasInternet"],
  [/bills included|utilities included/i, "billsIncluded"],
];

export type AmenityFlag = "hasBalcony" | "hasMaidRoom" | "hasPool" | "hasGym" | "hasSeaView" | "hasMarinaView" | "hasGarden" | "hasBbq" | "hasSecurity" | "hasCentralAc" | "hasInternet" | "billsIncluded";

export function amenityFlags(amenities: string[]): Partial<Record<AmenityFlag, boolean>> {
  const flags: Partial<Record<AmenityFlag, boolean>> = {};
  for (const a of amenities) for (const [re, flag] of AMENITY_FLAGS) if (re.test(a)) flags[flag] = true;
  return flags;
}

export function amenityList(value: unknown): string[] {
  return [...new Set(list(value).map((a) => str(a, 80)).filter((a): a is string => Boolean(a)))].slice(0, 100);
}

export function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new ListingError(message);
  return value;
}
