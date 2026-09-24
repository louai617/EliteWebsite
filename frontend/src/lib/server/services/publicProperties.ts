import 'server-only';
import mongoose from 'mongoose';
import { company } from '@/data/company';
import type { Agent, Property } from '@/data/properties';
import { connectToDatabase } from '../db';
import { PropertyModel, User, type PropertyDoc, type UserDoc } from '../models';
import { getSettings, type CrmSettings } from './settings';

/**
 * Read-side for the public website. Only published (`is_active`) listings are
 * visible, and nothing private (owner details, internal notes, CRM status
 * history) ever leaves this module.
 *
 * Pages using these render per request, so CRM changes appear immediately.
 */

const PUBLIC_FIELDS =
  '-owner -owner_contact -internal_notes -created_by -views';

const PLACEHOLDER_IMAGE = '/hero.svg';
const PLACEHOLDER_AGENT_PHOTO = '/logo.png';

type AgentDoc = Pick<
  UserDoc,
  '_id' | 'full_name' | 'full_name_ar' | 'title_en' | 'title_ar' | 'phone' | 'whatsapp' | 'email' | 'photo' | 'languages' | 'response_minutes' | 'is_superagent'
>;

interface AgencyStats {
  listingsByAgent: Map<string, number>;
  totalListings: number;
  verifiedAgents: number;
}

async function agencyStats(): Promise<AgencyStats> {
  const [byAgent, verifiedAgents] = await Promise.all([
    PropertyModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { is_active: true } },
      { $group: { _id: '$assigned_agent', count: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: { $in: ['admin', 'manager', 'broker'] }, is_active: true }),
  ]);
  return {
    listingsByAgent: new Map(byAgent.map((r) => [String(r._id), r.count])),
    totalListings: byAgent.reduce((sum, r) => sum + r.count, 0),
    verifiedAgents,
  };
}

function toAgent(agent: AgentDoc | null | undefined, stats: AgencyStats): Agent {
  const base = {
    agency_name_en: company.name.en,
    agency_name_ar: company.name.ar,
    agency_listings: stats.totalListings,
    verified_agents: stats.verifiedAgents,
  };
  if (!agent) {
    // No broker assigned: route enquiries to the office line.
    return {
      ...base,
      full_name_en: company.name.en,
      full_name_ar: company.name.ar,
      title_en: 'Sales Team',
      title_ar: 'فريق المبيعات',
      phone: company.contact.phones[0],
      whatsapp: company.contact.phonesRaw[0],
      email: company.contact.email ?? '',
      photo: PLACEHOLDER_AGENT_PHOTO,
      languages: ['en', 'ar'],
      response_minutes: 60,
      listings_count: stats.totalListings,
      is_superagent: false,
    };
  }
  return {
    ...base,
    full_name_en: agent.full_name,
    full_name_ar: agent.full_name_ar || agent.full_name,
    title_en: agent.title_en || 'Property Consultant',
    title_ar: agent.title_ar || agent.title_en || 'مستشار عقاري',
    phone: agent.phone || company.contact.phones[0],
    whatsapp: (agent.whatsapp || agent.phone || company.contact.phonesRaw[0]).replace(/\D/g, ''),
    email: agent.email ?? '',
    photo: agent.photo || PLACEHOLDER_AGENT_PHOTO,
    languages: (agent.languages?.length ? agent.languages : ['en']) as Agent['languages'],
    response_minutes: agent.response_minutes ?? 60,
    listings_count: stats.listingsByAgent.get(String(agent._id)) ?? 0,
    is_superagent: Boolean(agent.is_superagent),
  };
}

type PopulatedProperty = Omit<PropertyDoc, 'assigned_agent'> & { assigned_agent?: AgentDoc | null };

function toPublicProperty(doc: PopulatedProperty, stats: AgencyStats, settings: CrmSettings): Property {
  const loc = doc.location ?? {};
  const listedAt = doc.listed_at ?? doc.created_at ?? new Date();
  const typeOption = settings.property_types.find((t) => t.key === doc.type);
  const market = doc.market?.avg_price && doc.market?.price_history?.length ? doc.market : undefined;

  return {
    _id: String(doc._id),
    reference_number: doc.reference_number,
    title_en: doc.title_en,
    title_ar: doc.title_ar || doc.title_en,
    description_en: doc.description_en ?? '',
    description_ar: doc.description_ar || doc.description_en || '',
    type: doc.type,
    type_label_en: typeOption?.label_en,
    type_label_ar: typeOption?.label_ar || typeOption?.label_en,
    purpose: doc.purpose as Property['purpose'],
    price: doc.price,
    currency: doc.currency ?? 'QAR',
    price_frequency: doc.purpose === 'rent' ? ((doc.price_frequency as Property['price_frequency']) ?? 'year') : undefined,
    bedrooms: doc.bedrooms ?? 0,
    bathrooms: doc.bathrooms ?? 0,
    area_sqm: doc.area_sqm ?? 0,
    plot_sqm: doc.plot_sqm ?? undefined,
    floor: doc.floor ?? undefined,
    total_floors: doc.total_floors ?? undefined,
    parking: doc.parking ?? 0,
    furnishing: (doc.furnishing ?? 'unfurnished') as Property['furnishing'],
    completion: (doc.completion ?? 'ready') as Property['completion'],
    ownership: (doc.ownership ?? 'freehold') as Property['ownership'],
    available_from: (doc.available_from ?? listedAt).toISOString(),
    handover: doc.handover ?? undefined,
    developer_en: doc.developer_en ?? undefined,
    developer_ar: doc.developer_ar || doc.developer_en || undefined,
    year_built: doc.year_built ?? undefined,
    service_charge_sqm: doc.service_charge_sqm ?? undefined,
    location: {
      city_en: loc.city_en ?? 'Doha',
      city_ar: loc.city_ar || loc.city_en || 'الدوحة',
      area_en: loc.area_en ?? '',
      area_ar: loc.area_ar || loc.area_en || '',
      community_en: loc.community_en || loc.area_en || '',
      community_ar: loc.community_ar || loc.community_en || loc.area_ar || loc.area_en || '',
      address_en: loc.address_en || [loc.community_en, loc.area_en, loc.city_en].filter(Boolean).join(', '),
      address_ar: loc.address_ar || loc.address_en || '',
      lat: loc.lat ?? 25.2854,
      lng: loc.lng ?? 51.531,
    },
    amenities: doc.amenities ?? [],
    highlights: doc.highlights ?? [],
    images: doc.images?.length ? doc.images : [PLACEHOLDER_IMAGE],
    floor_plan: doc.floor_plan ?? undefined,
    is_featured: Boolean(doc.is_featured),
    is_verified: Boolean(doc.is_verified),
    is_exclusive: Boolean(doc.is_exclusive),
    listed_days_ago: Math.max(0, Math.floor((Date.now() - new Date(listedAt).getTime()) / 86_400_000)),
    agent: toAgent(doc.assigned_agent, stats),
    market: market
      ? {
          avg_price: market.avg_price ?? 0,
          avg_size_sqm: market.avg_size_sqm ?? 0,
          community_listings: market.community_listings ?? 0,
          community_buildings: market.community_buildings ?? 0,
          price_history: (market.price_history ?? []).map((p) => ({
            label: p.label ?? '',
            community: p.community ?? 0,
            city: p.city ?? 0,
          })),
        }
      : undefined,
    nearby: (doc.nearby ?? []) as Property['nearby'],
    payment_plan: doc.payment_plan?.length ? (doc.payment_plan as Property['payment_plan']) : undefined,
  };
}

const AGENT_FIELDS = 'full_name full_name_ar title_en title_ar phone whatsapp email photo languages response_minutes is_superagent';

async function mapMany(docs: PopulatedProperty[]): Promise<Property[]> {
  if (docs.length === 0) return [];
  const [stats, settings] = await Promise.all([agencyStats(), getSettings()]);
  return docs.map((d) => toPublicProperty(d, stats, settings));
}

export type PublicSort = 'newest' | 'price-low' | 'price-high';

const SORTS: Record<PublicSort, Record<string, 1 | -1>> = {
  newest: { is_featured: -1, listed_at: -1, _id: -1 },
  'price-low': { price: 1, _id: 1 },
  'price-high': { price: -1, _id: -1 },
};

export async function listPublicProperties(opts: {
  featured?: boolean;
  sort?: PublicSort;
  page?: number;
  limit?: number;
} = {}): Promise<{ items: Property[]; total: number; page: number; pages: number }> {
  await connectToDatabase();
  const limit = Math.min(opts.limit ?? 24, 60);
  const page = Math.max(1, opts.page ?? 1);
  const filter: Record<string, unknown> = { is_active: true };
  if (opts.featured) filter.is_featured = true;

  const [docs, total] = await Promise.all([
    PropertyModel.find(filter)
      .select(PUBLIC_FIELDS)
      .sort(SORTS[opts.sort ?? 'newest'])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'assigned_agent', select: AGENT_FIELDS, match: { is_active: true } })
      .lean<PopulatedProperty[]>(),
    PropertyModel.countDocuments(filter),
  ]);
  return { items: await mapMany(docs), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Look up a published listing by id or reference number (e.g. /properties/ELT-00123). */
export async function getPublicProperty(idOrRef: string): Promise<Property | null> {
  await connectToDatabase();
  const byId = /^[a-f\d]{24}$/i.test(idOrRef);
  const ref = idOrRef.toUpperCase();
  if (!byId && !/^[A-Z0-9-]{1,30}$/.test(ref)) return null;

  const doc = await PropertyModel.findOne(
    byId ? { _id: new mongoose.Types.ObjectId(idOrRef), is_active: true } : { reference_number: ref, is_active: true }
  )
    .select(PUBLIC_FIELDS)
    .populate({ path: 'assigned_agent', select: AGENT_FIELDS, match: { is_active: true } })
    .lean<PopulatedProperty>();
  if (!doc) return null;
  const [mapped] = await mapMany([doc]);
  return mapped;
}

/** Same purpose first, then closest price — mirrors the original similar-listings rule. */
export async function getSimilarPublicProperties(property: Property, limit = 3): Promise<Property[]> {
  await connectToDatabase();
  const id = new mongoose.Types.ObjectId(property._id);
  const nearest = await PropertyModel.aggregate<PopulatedProperty>([
    { $match: { is_active: true, _id: { $ne: id } } },
    {
      $addFields: {
        _purposeMatch: { $cond: [{ $eq: ['$purpose', property.purpose] }, 0, 1] },
        _priceGap: { $abs: { $subtract: ['$price', property.price] } },
      },
    },
    { $sort: { _purposeMatch: 1, _priceGap: 1 } },
    { $limit: limit },
    { $project: { owner: 0, owner_contact: 0, internal_notes: 0, created_by: 0, views: 0, _purposeMatch: 0, _priceGap: 0 } },
  ]);
  const docs = await PropertyModel.populate(nearest, {
    path: 'assigned_agent',
    select: AGENT_FIELDS,
    match: { is_active: true },
  });
  return mapMany(docs as PopulatedProperty[]);
}

