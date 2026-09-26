/**
 * Development seed — realistic Doha / Qatar data.
 *
 *   npx prisma db seed        (or: npm run db:seed)
 *
 * WARNING: wipes every CRM table first. Never point this at a production database.
 */
import "dotenv/config";

// Seed times (viewings at 10:00, tasks due at 15:00…) are Doha wall-clock times.
process.env.TZ = "Asia/Qatar";
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  PrismaClient,
  type ActivityAction,
  type CustomerType,
  type DealStatus,
  type EntityType,
  type Furnishing,
  type LeadSource,
  type LeadStatus,
  type ListingPurpose,
  type Priority,
  type PropertyStatus,
  type PropertyType,
  type Role,
  type TaskStatus,
  type ViewingStatus,
} from "../src/generated/prisma/client";
import { calculateCommission } from "../src/lib/commission";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run the development seed with NODE_ENV=production.");
}

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

// ─── Deterministic randomness so every seed produces the same dataset ───
let state = 20260926;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

const now = new Date();
const DAY = 86_400_000;
/** A past moment `d` days ago at a business hour (never in the future). */
const daysAgo = (d: number, hour = int(9, 18)) => {
  const date = new Date(now.getTime() - d * DAY);
  date.setHours(hour, pick([0, 15, 30, 45]), 0, 0);
  return date > now ? new Date(now.getTime() - int(20, 240) * 60_000) : date;
};
/** A moment `d` days ahead at a business hour (may be earlier today when d = 0). */
const daysFromNow = (d: number, hour = int(9, 18)) => {
  const date = new Date(now.getTime() + d * DAY);
  date.setHours(hour, pick([0, 15, 30, 45]), 0, 0);
  return date;
};

const phone = () => `+974 ${pick(["3", "5", "6", "7"])}${int(100, 999)} ${int(1000, 9999)}`;

// ─── Reference data ───
const PHOTO_IDS = [
  "1600585154340-be6161a56a0c", "1600596542815-ffad4c1539a9", "1600607687939-ce8a6c25118c",
  "1600566753190-17f0baa2a6c3", "1600210492486-724fe5c67fb0", "1600607687920-4e2a09cf159d",
  "1512917774080-9991f1c4c750", "1545324418-cc1a3fa10c00", "1613977257363-707ba9348227",
  "1484154218962-a197022b5858", "1502672260266-1c1ef2d93688", "1560448204-e02f11c3d0e2",
  "1600047509807-ba8f99d2cdde", "1600121848594-d8644e57abab", "1600210492493-0946911123ea",
  "1600566753086-00f18fb6b3ea", "1600566753376-12c8ab7fb75b", "1600573472550-8090b5e0745e",
  "1600585152220-90363fe7e115", "1600585154526-990dced4db0d", "1600607687644-c7171b42498b",
];
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?q=80&w=1600&auto=format&fit=crop`;

interface AreaSpec {
  area: string;
  buildings: string[];
  lat: number;
  lng: number;
  waterfront: boolean;
}
const AREAS: AreaSpec[] = [
  { area: "The Pearl", buildings: ["Porto Arabia Tower 12", "Viva Bahriya Tower 29", "Qanat Quartier", "Abraj Quartier Tower 3", "Medina Centrale"], lat: 25.3706, lng: 51.5504, waterfront: true },
  { area: "Lusail", buildings: ["Marina District Residences", "Fox Hills Block A", "Waterfront Residential", "Lusail Marina Tower 17", "Energy City Towers"], lat: 25.4209, lng: 51.4904, waterfront: true },
  { area: "West Bay", buildings: ["Zig Zag Tower B", "West Bay Lagoon Villas", "Burj Al Marina", "Doha Tower Residences"], lat: 25.3244, lng: 51.5314, waterfront: true },
  { area: "Msheireb", buildings: ["Msheireb Downtown Residence 4", "Al Kahraba Apartments", "Barahat Residences"], lat: 25.2868, lng: 51.5264, waterfront: false },
  { area: "Al Sadd", buildings: ["Al Sadd Plaza Tower", "Suhaim Bin Hamad Residence", "Royal Plaza Residences"], lat: 25.2842, lng: 51.4933, waterfront: false },
  { area: "Al Nasr", buildings: ["Al Nasr Residence", "Mirqab Heights"], lat: 25.2771, lng: 51.5068, waterfront: false },
  { area: "Al Waab", buildings: ["Al Waab Compound", "Aspire Villas", "Al Waab Street Villas"], lat: 25.2623, lng: 51.4617, waterfront: false },
  { area: "Ain Khaled", buildings: ["Ain Khaled Gardens", "Ain Khaled Compound"], lat: 25.2224, lng: 51.4617, waterfront: false },
  { area: "Old Airport", buildings: ["Old Airport Residence", "Matar Qadeem Tower"], lat: 25.2530, lng: 51.5540, waterfront: false },
];

const NATIONALITIES = ["Qatari", "Egyptian", "Indian", "British", "Lebanese", "Jordanian", "Filipino", "Pakistani", "Syrian", "Tunisian", "Canadian", "French", "Sudanese", "Moroccan", "American"];

const FIRST_NAMES = ["Ahmed", "Mohammed", "Fatima", "Mariam", "Omar", "Hessa", "Khalid", "Noura", "Yousef", "Sara", "Ali", "Aisha", "Hamad", "Reem", "Tariq", "Laila", "Rashid", "Dana", "Faisal", "Huda", "David", "Emily", "Priya", "Arjun", "Maria", "Jean", "Nadia", "Karim", "Rania", "Samir"];
const LAST_NAMES = ["Al-Kuwari", "Al-Marri", "Al-Sulaiti", "Al-Mohannadi", "Al-Naimi", "Al-Emadi", "Hassan", "Haddad", "Khoury", "Mansour", "Farouk", "Rahman", "Sharma", "Nair", "Thompson", "Walker", "Santos", "Dubois", "Saleh", "Aziz", "Qureshi", "Benali"];

const personName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
const emailFor = (name: string, domain = pick(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"])) =>
  `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}${int(1, 99)}@${domain}`;

// ─── Activity helper ───
type Links = Partial<Record<"leadId" | "clientId" | "ownerId" | "propertyId" | "dealId" | "viewingId" | "taskId", string>>;
type ActivitySeed = {
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  description: string;
  userId: string | null;
  createdAt: Date;
  meta?: string;
} & Links;
const activities: ActivitySeed[] = [];

function log(
  action: ActivityAction,
  entityType: EntityType,
  entityId: string,
  entityLabel: string,
  description: string,
  userId: string | null,
  createdAt: Date,
  links: Links = {},
  meta?: Record<string, unknown>,
) {
  activities.push({ action, entityType, entityId, entityLabel, description, userId, createdAt, meta: meta ? JSON.stringify(meta) : undefined, ...links });
}

async function wipe() {
  // Children first (FK order).
  await db.activity.deleteMany();
  await db.note.deleteMany();
  await db.task.deleteMany();
  await db.deal.deleteMany();
  await db.viewing.deleteMany();
  await db.propertyInterest.deleteMany();
  await db.lead.deleteMany();
  await db.client.deleteMany();
  await db.propertyImage.deleteMany();
  await db.property.deleteMany();
  await db.owner.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.settings.deleteMany();
  await db.counter.deleteMany();
}

/** A fresh clone has no tables until migrations run — apply them instead of failing. */
async function ensureSchema() {
  const tables = await db.$queryRaw<{ name: string }[]>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Activity'`;
  if (tables.length > 0) return;
  console.log("Database has no tables yet — applying migrations (prisma migrate deploy)…");
  await db.$disconnect();
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

/** Turns the usual setup mistakes into one actionable line instead of a stack trace. */
function explain(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/does not exist in the current database|no such table/i.test(message)) {
    return "The database tables are missing or out of date. Run: npx prisma migrate dev";
  }
  if (/NODE_MODULE_VERSION|bindings file|better_sqlite3\.node|was compiled against a different Node/i.test(message)) {
    return "better-sqlite3 was built for a different Node.js version. Run: npm rebuild better-sqlite3";
  }
  if (/SQLITE_CANTOPEN|unable to open database/i.test(message)) {
    return `Cannot open the SQLite file (DATABASE_URL=${process.env.DATABASE_URL ?? "file:./dev.db"}). Check the path and folder permissions.`;
  }
  return null;
}

async function main() {
  console.log("Seeding ELITE CRM…");
  await ensureSchema();
  await wipe();

  const settings = await db.settings.create({
    data: { id: "default", companyName: "ELITE Real Estate", saleCommissionPercent: 2, rentalCommissionPercent: 8.33, agentSharePercent: 40 },
  });

  // ─── Users ───
  const devPassword = await bcrypt.hash("Elite@2026", 12);
  const adminPassword = await bcrypt.hash("Admin@2026", 12);
  const userSpecs: { name: string; email: string; role: Role; phone: string }[] = [
    { name: "Khalid Al-Mansoori", email: "admin@elite.qa", role: "ADMIN", phone: "+974 5500 1000" },
    { name: "Fatima Al-Sulaiti", email: "fatima@elite.qa", role: "MANAGER", phone: "+974 5500 2001" },
    { name: "James Whitaker", email: "james@elite.qa", role: "MANAGER", phone: "+974 5500 2002" },
    { name: "Omar Haddad", email: "omar@elite.qa", role: "AGENT", phone: "+974 5500 3001" },
    { name: "Aisha Rahman", email: "aisha@elite.qa", role: "AGENT", phone: "+974 5500 3002" },
    { name: "Rohan Mehta", email: "rohan@elite.qa", role: "AGENT", phone: "+974 5500 3003" },
    { name: "Layla Nasser", email: "layla@elite.qa", role: "AGENT", phone: "+974 5500 3004" },
    { name: "Youssef Benali", email: "youssef@elite.qa", role: "AGENT", phone: "+974 5500 3005" },
  ];
  const users = [];
  for (const spec of userSpecs) {
    users.push(
      await db.user.create({
        data: {
          ...spec,
          passwordHash: spec.role === "ADMIN" ? adminPassword : devPassword,
          createdAt: daysAgo(220),
        },
      }),
    );
  }
  const admin = users[0];
  const managers = users.filter((u) => u.role === "MANAGER");
  const agents = users.filter((u) => u.role === "AGENT");
  const staff = [...managers, ...agents];

  // ─── Owners ───
  const owners = [];
  for (let i = 0; i < 15; i++) {
    const fullName = personName();
    const createdAt = daysAgo(int(120, 200));
    const creator = pick(staff);
    const owner = await db.owner.create({
      data: {
        fullName,
        phone: phone(),
        secondaryPhone: chance(0.4) ? phone() : null,
        email: chance(0.85) ? emailFor(fullName) : null,
        nationality: pick(NATIONALITIES),
        notes: pick([
          "Prefers WhatsApp. Responds in the evening.",
          "Owns units through a family company — contracts signed by the eldest son.",
          "Open to price negotiation for long-term tenants.",
          "Wants quarterly updates on listing performance.",
          null,
        ]),
        createdById: creator.id,
        createdAt,
      },
    });
    owners.push(owner);
    log("CREATED", "OWNER", owner.id, owner.fullName, `Added owner ${owner.fullName}`, creator.id, createdAt, { ownerId: owner.id });
  }

  // ─── Properties ───
  type Template = { type: PropertyType; beds: [number, number]; sqm: [number, number]; rent: [number, number]; sale: [number, number] };
  const TEMPLATES: Template[] = [
    { type: "STUDIO", beds: [0, 0], sqm: [40, 60], rent: [4500, 7500], sale: [650_000, 900_000] },
    { type: "APARTMENT", beds: [1, 3], sqm: [75, 190], rent: [7000, 18000], sale: [950_000, 3_200_000] },
    { type: "APARTMENT", beds: [1, 2], sqm: [70, 140], rent: [6500, 14000], sale: [900_000, 2_100_000] },
    { type: "PENTHOUSE", beds: [3, 4], sqm: [260, 420], rent: [28000, 45000], sale: [5_500_000, 9_800_000] },
    { type: "TOWNHOUSE", beds: [2, 4], sqm: [180, 300], rent: [16000, 26000], sale: [3_000_000, 5_200_000] },
    { type: "VILLA", beds: [4, 6], sqm: [350, 650], rent: [18000, 38000], sale: [4_200_000, 12_000_000] },
    { type: "COMPOUND_VILLA", beds: [3, 5], sqm: [280, 450], rent: [15000, 26000], sale: [3_500_000, 6_500_000] },
    { type: "DUPLEX", beds: [2, 4], sqm: [180, 320], rent: [14000, 24000], sale: [2_800_000, 5_000_000] },
    { type: "OFFICE", beds: [0, 0], sqm: [90, 400], rent: [12000, 40000], sale: [2_000_000, 7_000_000] },
  ];
  const TITLE_ADJ = ["Sea-view", "Spacious", "Modern", "Fully furnished", "Brand new", "Upgraded", "Bright", "Luxury", "Corner", "Family"];
  const TYPE_WORD: Record<PropertyType, string> = {
    APARTMENT: "apartment", VILLA: "villa", TOWNHOUSE: "townhouse", PENTHOUSE: "penthouse", STUDIO: "studio",
    DUPLEX: "duplex", COMPOUND_VILLA: "compound villa", OFFICE: "office", SHOP: "shop", WAREHOUSE: "warehouse",
    LAND: "plot", BUILDING: "building",
  };

  // Status mix: most available, some already transacted (kept consistent with deals below).
  const statusPlan: PropertyStatus[] = [
    ...Array<PropertyStatus>(19).fill("AVAILABLE"),
    "RESERVED", "RESERVED", "RESERVED",
    "RENTED", "RENTED", "RENTED",
    "SOLD", "SOLD",
    "OFF_MARKET", "OFF_MARKET", "OFF_MARKET",
  ];

  const properties = [];
  for (let i = 0; i < 30; i++) {
    const loc = AREAS[i % AREAS.length];
    const tpl = loc.area === "Al Waab" || loc.area === "Ain Khaled"
      ? pick(TEMPLATES.filter((t) => ["VILLA", "COMPOUND_VILLA", "TOWNHOUSE"].includes(t.type)))
      : loc.area === "West Bay" && chance(0.3)
        ? TEMPLATES.find((t) => t.type === "OFFICE")!
        : pick(TEMPLATES.filter((t) => !["VILLA", "COMPOUND_VILLA", "OFFICE"].includes(t.type)));
    let status = statusPlan[i];
    const purpose: ListingPurpose = status === "SOLD" ? "SALE" : status === "RENTED" ? "RENT" : chance(0.6) ? "RENT" : "SALE";
    const beds = int(tpl.beds[0], tpl.beds[1]);
    const isResidential = tpl.type !== "OFFICE";
    const sqm = int(tpl.sqm[0], tpl.sqm[1]);
    const price = purpose === "RENT" ? roundTo(int(tpl.rent[0], tpl.rent[1]), 500) : roundTo(int(tpl.sale[0], tpl.sale[1]), 50_000);
    const building = pick(loc.buildings);
    const furnishing: Furnishing = pick(["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"]);
    const title = `${pick(TITLE_ADJ)} ${beds > 0 ? `${beds}BR ` : ""}${TYPE_WORD[tpl.type]} in ${loc.area}`;
    const agent = agents[i % agents.length];
    const owner = owners[i % owners.length];
    const createdAt = daysAgo(int(60, 170));
    const isVilla = ["VILLA", "COMPOUND_VILLA", "TOWNHOUSE"].includes(tpl.type);
    if (i === 29) status = "AVAILABLE";

    const property = await db.property.create({
      data: {
        reference: `ELT-${1001 + i}`,
        title,
        type: tpl.type,
        purpose,
        status,
        price,
        areaSqm: sqm,
        bedrooms: isResidential ? beds : null,
        bathrooms: isResidential ? Math.max(1, beds + int(0, 1)) : int(1, 2),
        floor: isVilla ? null : int(1, 38),
        buildingNumber: String(int(1, 250)),
        tower: isVilla ? null : pick(["A", "B", "C", "North", "South", null]),
        yearBuilt: int(2008, 2024),
        area: loc.area,
        street: pick(["Porto Arabia Drive", "Lusail Expressway", "Al Corniche Street", "Al Waab Street", "Salwa Road", "Al Sadd Street", "C Ring Road", "Msheireb Street", null]),
        buildingName: building,
        latitude: +(loc.lat + (rand() - 0.5) * 0.02).toFixed(6),
        longitude: +(loc.lng + (rand() - 0.5) * 0.02).toFixed(6),
        googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(`${building}, ${loc.area}, Doha`)}`,
        furnishing: isResidential ? furnishing : null,
        description:
          `${title} located in ${building}, ${loc.area}. ${sqm} sqm of ${furnishing === "FURNISHED" ? "fully furnished" : "well-kept"} living space` +
          `${loc.waterfront ? " with open views across the water" : ""}. Close to schools, supermarkets and the Doha Metro. ` +
          `${purpose === "RENT" ? "Available for a 12-month contract with flexible cheques." : "Freehold title for all nationalities where permitted."}`,
        parkingSpaces: isVilla ? int(2, 4) : int(1, 2),
        hasBalcony: !isVilla && chance(0.7),
        hasMaidRoom: beds >= 3 && chance(0.7),
        hasPool: chance(0.65),
        hasGym: chance(0.75),
        hasSeaView: loc.waterfront && chance(0.6),
        hasMarinaView: (loc.area === "The Pearl" || loc.area === "Lusail") && chance(0.5),
        hasGarden: isVilla && chance(0.8),
        hasBbq: isVilla && chance(0.5),
        hasSecurity: chance(0.9),
        hasCentralAc: chance(0.85),
        hasInternet: chance(0.5),
        billsIncluded: purpose === "RENT" && chance(0.3),
        propertyFinderUrl: chance(0.7) ? `https://www.propertyfinder.qa/en/plp/${purpose === "RENT" ? "rent" : "buy"}/elite-${1001 + i}.html` : null,
        isFeatured: chance(0.2),
        seoTitle: `${title} | ELITE Real Estate`,
        seoDescription: `${title}. ${sqm} sqm, ${beds || "open"} bedrooms. Contact ELITE Real Estate Doha.`,
        ownerId: owner.id,
        agentId: agent.id,
        createdAt,
        images: {
          create: Array.from({ length: int(3, 5) }, (_, n) => ({
            url: photo(PHOTO_IDS[(i * 3 + n) % PHOTO_IDS.length]),
            sortOrder: n,
            isPrimary: n === 0,
            createdAt,
          })),
        },
      },
    });
    properties.push(property);
    log("CREATED", "PROPERTY", property.id, `${property.reference} · ${property.title}`, `Listed ${property.reference} — ${property.title}`, agent.id, createdAt, { propertyId: property.id, ownerId: owner.id });
    log("ASSIGNED", "PROPERTY", property.id, `${property.reference} · ${property.title}`, `Assigned ${property.reference} to ${agent.name}`, pick(managers).id, new Date(createdAt.getTime() + 3_600_000), { propertyId: property.id });
  }

  // ─── Clients ───
  const clientTypes: CustomerType[] = ["BUYER", "TENANT", "TENANT", "INVESTOR", "LANDLORD", "SELLER"];
  const clients = [];
  for (let i = 0; i < 20; i++) {
    const fullName = personName();
    const clientType = clientTypes[i % clientTypes.length];
    const agent = agents[i % agents.length];
    const createdAt = daysAgo(int(20, 150));
    const buying = clientType === "BUYER" || clientType === "INVESTOR";
    const budgetMax = buying ? roundTo(int(1_200_000, 8_000_000), 100_000) : roundTo(int(7000, 30000), 500);
    const client = await db.client.create({
      data: {
        fullName,
        phone: phone(),
        email: emailFor(fullName),
        nationality: pick(NATIONALITIES),
        idReference: chance(0.6) ? `QID ${int(28000000000, 29999999999)}` : null,
        clientType,
        budgetMin: Math.round(budgetMax * 0.7),
        budgetMax,
        requirements: pick([
          "2–3 bedrooms, sea view preferred, close to international schools.",
          "Villa with private garden and maid's room in a gated compound.",
          "High-yield unit for investment; open to tenanted properties.",
          "Walking distance to the Metro, furnished, move-in within a month.",
          "Office space of 150–250 sqm with parking for 4 cars.",
        ]),
        agentId: agent.id,
        createdAt,
      },
    });
    clients.push(client);
    log("CREATED", "CLIENT", client.id, client.fullName, `Added client ${client.fullName}`, agent.id, createdAt, { clientId: client.id });
  }

  // ─── Leads ───
  const leadStatusPlan: LeadStatus[] = [
    ...Array<LeadStatus>(10).fill("NEW"),
    ...Array<LeadStatus>(8).fill("CONTACTED"),
    ...Array<LeadStatus>(7).fill("QUALIFIED"),
    ...Array<LeadStatus>(5).fill("VIEWING_SCHEDULED"),
    ...Array<LeadStatus>(4).fill("NEGOTIATION"),
    ...Array<LeadStatus>(4).fill("WON"),
    ...Array<LeadStatus>(2).fill("LOST"),
  ];
  const SOURCES: LeadSource[] = ["PROPERTY_FINDER", "PROPERTY_FINDER", "PROPERTY_FINDER", "INSTAGRAM", "FACEBOOK", "TIKTOK", "WEBSITE", "WEBSITE", "WHATSAPP", "WHATSAPP", "REFERRAL", "WALK_IN", "PHONE", "OTHER"];
  const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "MEDIUM", "HIGH", "URGENT"];
  const leads = [];
  for (let i = 0; i < 40; i++) {
    const fullName = personName();
    const status = leadStatusPlan[i];
    const agent = i % 9 === 8 ? null : agents[i % agents.length]; // a few unassigned leads
    const createdAt = daysAgo(i < 12 ? int(0, 25) : int(26, 150));
    const property = pick(properties);
    const purpose = property.purpose;
    const budgetMax = purpose === "RENT" ? roundTo(property.price * (1 + rand() * 0.25), 500) : roundTo(property.price * (1 + rand() * 0.2), 50_000);
    const leadType: CustomerType = purpose === "RENT" ? "TENANT" : chance(0.3) ? "INVESTOR" : "BUYER";
    const convertedClient = status === "WON" || (status === "NEGOTIATION" && chance(0.5)) ? clients[i % clients.length] : null;
    const lead = await db.lead.create({
      data: {
        fullName: convertedClient?.fullName ?? fullName,
        phone: convertedClient?.phone ?? phone(),
        email: chance(0.8) ? convertedClient?.email ?? emailFor(fullName) : null,
        nationality: pick(NATIONALITIES),
        source: pick(SOURCES),
        leadType,
        interestedArea: property.area,
        purpose,
        budgetMin: Math.round(budgetMax * 0.75),
        budgetMax,
        bedrooms: property.bedrooms,
        furnishing: property.furnishing,
        notes: pick([
          "Relocating from Dubai in two months.",
          "Asked for a virtual tour first.",
          "Needs parking for 2 cars.",
          "Company lease — HR will sign.",
          "Flexible on area if budget fits.",
          null,
        ]),
        status,
        priority: pick(PRIORITIES),
        statusChangedAt: new Date(Math.max(createdAt.getTime(), Math.min(createdAt.getTime() + int(1, 10) * DAY, now.getTime() - int(30, 600) * 60_000))),
        agentId: agent?.id ?? null,
        clientId: convertedClient?.id ?? null,
        createdAt,
        interests: { create: [{ propertyId: property.id, createdAt }] },
      },
    });
    leads.push(lead);
    const label = lead.fullName;
    log("CREATED", "LEAD", lead.id, label, `New ${lead.source.replace("_", " ").toLowerCase()} lead ${label}`, agent?.id ?? admin.id, createdAt, { leadId: lead.id, propertyId: property.id });
    if (agent) log("ASSIGNED", "LEAD", lead.id, label, `Assigned ${label} to ${agent.name}`, pick(managers).id, new Date(createdAt.getTime() + 1_800_000), { leadId: lead.id }, { agentId: agent.id });
    if (status !== "NEW") {
      log("STATUS_CHANGED", "LEAD", lead.id, label, `Moved ${label} to ${status.replace("_", " ").toLowerCase()}`, agent?.id ?? admin.id, lead.statusChangedAt, { leadId: lead.id }, { from: "NEW", to: status });
    }
  }

  // ─── Viewings (past and upcoming) ───
  const viewings = [];
  const viewingPlan: { offset: number; status: ViewingStatus }[] = [
    { offset: -20, status: "COMPLETED" }, { offset: -14, status: "COMPLETED" }, { offset: -9, status: "COMPLETED" },
    { offset: -6, status: "NO_SHOW" }, { offset: -4, status: "CANCELLED" }, { offset: -2, status: "COMPLETED" },
    { offset: 0, status: "CONFIRMED" }, { offset: 0, status: "SCHEDULED" }, { offset: 1, status: "CONFIRMED" },
    { offset: 2, status: "SCHEDULED" }, { offset: 3, status: "SCHEDULED" }, { offset: 5, status: "SCHEDULED" },
    { offset: 7, status: "CONFIRMED" }, { offset: 9, status: "SCHEDULED" }, { offset: 12, status: "SCHEDULED" },
  ];
  const viewingLeads = leads.filter((l) => ["QUALIFIED", "VIEWING_SCHEDULED", "NEGOTIATION", "WON"].includes(l.status));
  for (const [i, plan] of viewingPlan.entries()) {
    const lead = viewingLeads[i % viewingLeads.length];
    const interest = await db.propertyInterest.findFirst({ where: { leadId: lead.id } });
    const propertyId = interest?.propertyId ?? pick(properties).id;
    const property = properties.find((p) => p.id === propertyId)!;
    const startsAt = plan.offset >= 0 ? daysFromNow(plan.offset, plan.offset === 0 ? int(14, 18) : int(10, 18)) : daysAgo(-plan.offset);
    const endsAt = new Date(startsAt.getTime() + pick([30, 45, 60]) * 60_000);
    const agentId = lead.agentId ?? property.agentId ?? agents[0].id;
    const createdAt = new Date(Math.min(startsAt.getTime() - 3 * DAY, now.getTime() - DAY));
    const viewing = await db.viewing.create({
      data: {
        propertyId,
        leadId: lead.id,
        clientId: lead.clientId,
        agentId,
        startsAt,
        endsAt,
        status: plan.status,
        notes: plan.status === "COMPLETED" ? pick(["Client liked the layout; asked about cheque flexibility.", "Concerned about road noise, wants a higher floor.", "Very interested — second viewing with spouse requested."]) : null,
        createdAt,
      },
    });
    viewings.push(viewing);
    const label = `${property.reference} with ${lead.fullName}`;
    log("CREATED", "VIEWING", viewing.id, label, `Scheduled viewing of ${property.reference} with ${lead.fullName}`, agentId, createdAt, { viewingId: viewing.id, propertyId, leadId: lead.id, clientId: lead.clientId ?? undefined });
    if (plan.status === "COMPLETED") {
      log("COMPLETED", "VIEWING", viewing.id, label, `Completed viewing of ${property.reference} with ${lead.fullName}`, agentId, endsAt, { viewingId: viewing.id, propertyId, leadId: lead.id });
    }
  }

  // ─── Deals ───
  const dealPlan: { status: DealStatus; monthsAgo: number }[] = [
    { status: "CLOSED_WON", monthsAgo: 5 }, { status: "CLOSED_WON", monthsAgo: 4 }, { status: "CLOSED_WON", monthsAgo: 3 },
    { status: "CLOSED_WON", monthsAgo: 2 }, { status: "CLOSED_WON", monthsAgo: 1 }, { status: "CLOSED_LOST", monthsAgo: 2 },
    { status: "CONTRACT_SIGNED", monthsAgo: 0 }, { status: "CONTRACT_PENDING", monthsAgo: 0 },
    { status: "NEGOTIATION", monthsAgo: 0 }, { status: "NEGOTIATION", monthsAgo: 0 },
  ];
  const rented = properties.filter((p) => p.status === "RENTED");
  const sold = properties.filter((p) => p.status === "SOLD");
  const reserved = properties.filter((p) => p.status === "RESERVED");
  const open = properties.filter((p) => p.status === "AVAILABLE");
  const dealProperties = [...rented, ...sold, open[0], ...reserved, open[1]];
  let dealCounter = 1000;
  const deals = [];
  for (const [i, plan] of dealPlan.entries()) {
    const property = dealProperties[i];
    const client = clients[(i * 3) % clients.length];
    const lead = leads.find((l) => l.clientId === client.id) ?? null;
    const type = property.purpose === "RENT" ? "RENTAL" : "SALE";
    const amount = type === "RENTAL" ? property.price * 12 : roundTo(property.price * (0.93 + rand() * 0.05), 10_000);
    const commissionPercent = type === "RENTAL" ? settings.rentalCommissionPercent : settings.saleCommissionPercent;
    const breakdown = calculateCommission({ amount, commissionPercent, agentSharePercent: settings.agentSharePercent });
    const closedAt = plan.status.startsWith("CLOSED") ? daysAgo(plan.monthsAgo * 30 + int(0, 12)) : null;
    const createdAt = closedAt ? new Date(closedAt.getTime() - int(15, 40) * DAY) : daysAgo(int(3, 20));
    dealCounter += 1;
    const deal = await db.deal.create({
      data: {
        reference: `DL-${dealCounter}`,
        propertyId: property.id,
        clientId: client.id,
        ownerId: property.ownerId,
        agentId: property.agentId,
        leadId: lead?.id ?? null,
        type,
        status: plan.status,
        amount,
        commissionPercent,
        agentSharePercent: settings.agentSharePercent,
        ...breakdown,
        contractDate: ["CONTRACT_SIGNED", "CLOSED_WON"].includes(plan.status) ? new Date((closedAt ?? now).getTime() - 5 * DAY) : null,
        closingDate: closedAt ?? daysFromNow(int(10, 40)),
        closedAt,
        notes: plan.status === "CLOSED_LOST" ? "Client chose a competing unit in Lusail." : null,
        createdAt,
      },
    });
    deals.push(deal);
    const label = `${deal.reference} · ${property.reference}`;
    log("CREATED", "DEAL", deal.id, label, `Opened ${type.toLowerCase()} deal ${deal.reference} for ${property.reference}`, property.agentId, createdAt, { dealId: deal.id, propertyId: property.id, clientId: client.id, leadId: lead?.id });
    if (closedAt) {
      log("CLOSED", "DEAL", deal.id, label, `${plan.status === "CLOSED_WON" ? "Closed won" : "Closed lost"}: ${deal.reference}`, property.agentId, closedAt, { dealId: deal.id, propertyId: property.id, clientId: client.id }, { to: plan.status });
    }
  }
  await db.counter.createMany({
    data: [
      { name: "property", value: 1000 + properties.length },
      { name: "deal", value: dealCounter },
    ],
  });

  // ─── Tasks ───
  const TASK_TITLES = [
    "Call back about budget", "Send shortlist of 3 units", "Prepare tenancy contract", "Collect QID copy",
    "Confirm viewing time with owner", "Request updated photos", "Follow up after viewing", "Renew Property Finder listing",
    "Negotiate price with owner", "Send payment schedule", "Arrange key handover", "Chase security cheque",
    "Update listing description", "Book photographer", "Share floor plan", "Verify title deed",
  ];
  const taskPlan: { due: number; status: TaskStatus }[] = [
    ...Array.from({ length: 5 }, (_, i) => ({ due: -(i + 1) * 2, status: "TODO" as TaskStatus })), // overdue
    ...Array.from({ length: 4 }, () => ({ due: 0, status: "TODO" as TaskStatus })), // today
    ...Array.from({ length: 2 }, () => ({ due: 0, status: "IN_PROGRESS" as TaskStatus })),
    ...Array.from({ length: 7 }, (_, i) => ({ due: i + 1, status: (i % 3 === 0 ? "IN_PROGRESS" : "TODO") as TaskStatus })),
    ...Array.from({ length: 5 }, (_, i) => ({ due: -(i + 3), status: "COMPLETED" as TaskStatus })),
    ...Array.from({ length: 2 }, (_, i) => ({ due: -(i + 6), status: "CANCELLED" as TaskStatus })),
  ];
  for (const [i, plan] of taskPlan.entries()) {
    const assignee = i % 6 === 5 ? pick(managers) : agents[i % agents.length];
    const lead = chance(0.6) ? leads[(i * 7) % leads.length] : null;
    const property = chance(0.5) ? properties[(i * 5) % properties.length] : null;
    const client = !lead && chance(0.5) ? clients[i % clients.length] : null;
    const dueDate = plan.due >= 0 ? daysFromNow(plan.due, int(10, 17)) : daysAgo(-plan.due, int(10, 17));
    const createdAt = new Date(Math.min(dueDate.getTime(), now.getTime()) - int(2, 8) * DAY);
    const title = TASK_TITLES[i % TASK_TITLES.length];
    const task = await db.task.create({
      data: {
        title,
        description: chance(0.5) ? "Keep the client updated on WhatsApp once done." : null,
        status: plan.status,
        priority: pick(PRIORITIES),
        dueDate,
        completedAt: plan.status === "COMPLETED" ? dueDate : null,
        assigneeId: assignee.id,
        createdById: pick(managers).id,
        leadId: lead?.id ?? null,
        clientId: client?.id ?? null,
        propertyId: property?.id ?? null,
        createdAt,
      },
    });
    log("CREATED", "TASK", task.id, task.title, `Created task “${task.title}” for ${assignee.name}`, task.createdById, createdAt, { taskId: task.id, leadId: lead?.id, propertyId: property?.id, clientId: client?.id });
    if (plan.status === "COMPLETED") {
      log("COMPLETED", "TASK", task.id, task.title, `Completed task “${task.title}”`, assignee.id, dueDate, { taskId: task.id, leadId: lead?.id, propertyId: property?.id });
    }
  }

  // ─── Notes ───
  const NOTE_TEXT = [
    "Spoke on WhatsApp — prefers viewings after 5pm.",
    "Owner agreed to include one parking space in the price.",
    "Client asked for the service charge breakdown.",
    "Sent the brochure and floor plan by email.",
    "Budget can stretch by 10% for a sea view.",
    "Needs a company letter before signing.",
    "Second viewing requested with family on the weekend.",
    "Owner will repaint before handover.",
  ];
  const noteTargets: { key: keyof Links; id: string; label: string; entity: EntityType }[] = [
    ...leads.slice(0, 14).map((l) => ({ key: "leadId" as const, id: l.id, label: l.fullName, entity: "LEAD" as EntityType })),
    ...properties.slice(0, 8).map((p) => ({ key: "propertyId" as const, id: p.id, label: `${p.reference} · ${p.title}`, entity: "PROPERTY" as EntityType })),
    ...clients.slice(0, 6).map((c) => ({ key: "clientId" as const, id: c.id, label: c.fullName, entity: "CLIENT" as EntityType })),
    ...owners.slice(0, 4).map((o) => ({ key: "ownerId" as const, id: o.id, label: o.fullName, entity: "OWNER" as EntityType })),
    ...deals.slice(0, 4).map((d) => ({ key: "dealId" as const, id: d.id, label: d.reference, entity: "DEAL" as EntityType })),
  ];
  for (const target of noteTargets) {
    const author = pick(staff);
    const createdAt = daysAgo(int(0, 30));
    await db.note.create({
      data: { content: pick(NOTE_TEXT), authorId: author.id, [target.key]: target.id, createdAt },
    });
    log("NOTE_ADDED", target.entity, target.id, target.label, `Added a note to ${target.label}`, author.id, createdAt, { [target.key]: target.id });
  }

  await db.activity.createMany({ data: activities });

  const counts = {
    users: await db.user.count(),
    owners: await db.owner.count(),
    properties: await db.property.count(),
    images: await db.propertyImage.count(),
    leads: await db.lead.count(),
    clients: await db.client.count(),
    viewings: await db.viewing.count(),
    deals: await db.deal.count(),
    tasks: await db.task.count(),
    notes: await db.note.count(),
    activities: await db.activity.count(),
  };
  console.table(counts);
  console.log("Done. Log in with admin@elite.qa / Admin@2026 (see README for the other accounts).");
}

main()
  .catch((error) => {
    console.error(error);
    const hint = explain(error);
    if (hint) console.error(`\n✖ Seed failed: ${hint}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
