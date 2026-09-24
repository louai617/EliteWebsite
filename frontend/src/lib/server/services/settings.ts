import 'server-only';
import {
  DEFAULT_LEAD_SOURCES,
  DEFAULT_LEAD_STATUSES,
  DEFAULT_LOCATIONS,
  DEFAULT_PROPERTY_TYPES,
  type LeadStatusOption,
  type LocationOption,
  type PropertyTypeOption,
  type SimpleOption,
} from '@/lib/shared/constants';
import { Setting } from '../models';
import { badRequest } from '../http';
import { DEFAULT_AI_CONFIG, DEFAULT_SETTINGS, type CrmSettings } from './defaults';

export { DEFAULT_SETTINGS, type CrmSettings, type AiSequence } from './defaults';

// Settings are read on almost every write; cache them briefly per server instance.
const TTL_MS = 30_000;
let cached: { value: CrmSettings; at: number } | null = null;

export function invalidateSettingsCache() {
  cached = null;
}

/** Load the CRM settings document, creating it with defaults the first time. */
export async function getSettings(): Promise<CrmSettings> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  let doc = await Setting.findOne({ key: 'crm' }).lean();
  if (!doc) {
    doc = await Setting.findOneAndUpdate(
      { key: 'crm' },
      { $setOnInsert: { key: 'crm', ...DEFAULT_SETTINGS } },
      { upsert: true, returnDocument: 'after', lean: true }
    );
  }

  const value = {
    lead_statuses: (doc?.lead_statuses as LeadStatusOption[] | undefined)?.length
      ? (doc!.lead_statuses as LeadStatusOption[])
      : DEFAULT_LEAD_STATUSES,
    lead_sources: (doc?.lead_sources as SimpleOption[] | undefined)?.length
      ? (doc!.lead_sources as SimpleOption[])
      : DEFAULT_LEAD_SOURCES,
    locations: (doc?.locations as LocationOption[] | undefined)?.length
      ? (doc!.locations as LocationOption[])
      : DEFAULT_LOCATIONS,
    property_types: (doc?.property_types as PropertyTypeOption[] | undefined)?.length
      ? (doc!.property_types as PropertyTypeOption[])
      : DEFAULT_PROPERTY_TYPES,
    ai_config: (doc?.ai_config as CrmSettings['ai_config'] | undefined) ?? DEFAULT_AI_CONFIG,
  } satisfies CrmSettings;

  cached = { value, at: Date.now() };
  return value;
}

/** First "open" status — where new leads start. */
export function defaultLeadStatus(settings: CrmSettings): string {
  return settings.lead_statuses.find((s) => s.category === 'open')?.key ?? settings.lead_statuses[0].key;
}

export function statusKeysByCategory(settings: CrmSettings, category: 'open' | 'won' | 'lost'): string[] {
  return settings.lead_statuses.filter((s) => s.category === category).map((s) => s.key);
}

export function assertLeadStatus(settings: CrmSettings, key: string | null | undefined) {
  if (key && !settings.lead_statuses.some((s) => s.key === key)) {
    throw badRequest(`Unknown lead status "${key}". Configure it in Settings first.`);
  }
}

export function assertLeadSource(settings: CrmSettings, key: string | null | undefined) {
  if (key && !settings.lead_sources.some((s) => s.key === key)) {
    throw badRequest(`Unknown lead source "${key}". Configure it in Settings first.`);
  }
}

export function assertPropertyType(settings: CrmSettings, key: string | null | undefined) {
  if (key && !settings.property_types.some((t) => t.key === key)) {
    throw badRequest(`Unknown property type "${key}". Configure it in Settings first.`);
  }
}

export function findLocation(settings: CrmSettings, key: string | null | undefined): LocationOption | undefined {
  if (!key) return undefined;
  const location = settings.locations.find((l) => l.key === key);
  if (!location) throw badRequest(`Unknown location "${key}". Configure it in Settings first.`);
  return location;
}
