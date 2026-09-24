/**
 * JSON shapes returned by the CRM API, as the browser sees them (ids and dates
 * are strings). Populated references arrive as small objects.
 */
import type {
  ClientType,
  DealStatus,
  LeadStatusOption,
  LocationOption,
  Priority,
  PropertyStatus,
  PropertyTypeOption,
  Role,
  SimpleOption,
  TaskType,
  ViewingStatus,
} from './constants';
import type { Permission } from './permissions';

export interface SessionUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  photo: string | null;
  role: Role;
  title_en: string | null;
  permissions: Permission[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface AgentRef {
  _id: string;
  full_name: string;
  photo?: string;
  email?: string;
  phone?: string;
}

export interface PropertyRef {
  _id: string;
  title_en: string;
  reference_number: string;
  location?: { area_en?: string; community_en?: string };
  price?: number;
  currency?: string;
  purpose?: string;
  images?: string[];
}

export interface PersonRef {
  _id: string;
  full_name: string;
  phone?: string;
  email?: string;
  types?: ClientType[];
  status?: string;
}

export interface LeadRow {
  _id: string;
  full_name: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  source: string;
  status: string;
  priority: Priority;
  assigned_agent?: AgentRef | null;
  interested_properties: PropertyRef[];
  purpose?: 'sale' | 'rent';
  property_type?: string;
  preferred_location?: string;
  budget_min?: number;
  budget_max?: number;
  bedrooms?: number;
  bathrooms?: number;
  message?: string;
  notes?: string;
  tags: string[];
  last_contact_at?: string;
  next_follow_up_at?: string;
  client?: PersonRef | null;
  created_at: string;
  updated_at: string;
}

export interface ClientRow {
  _id: string;
  full_name: string;
  types: ClientType[];
  phone?: string;
  email?: string;
  whatsapp?: string;
  nationality?: string;
  company?: string;
  preferred_locations: string[];
  requirements?: {
    purpose?: 'sale' | 'rent';
    property_types?: string[];
    bedrooms_min?: number;
    bathrooms_min?: number;
    furnishing?: string;
    notes?: string;
  };
  budget_min?: number;
  budget_max?: number;
  currency?: string;
  notes?: string;
  tags: string[];
  assigned_agent?: AgentRef | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyRow {
  _id: string;
  reference_number: string;
  title_en: string;
  title_ar?: string;
  description_en?: string;
  description_ar?: string;
  type: string;
  purpose: 'sale' | 'rent';
  status: PropertyStatus;
  is_active: boolean;
  is_featured: boolean;
  is_verified?: boolean;
  is_exclusive?: boolean;
  price: number;
  currency: string;
  price_frequency?: 'year' | 'month';
  bedrooms?: number;
  bathrooms?: number;
  area_sqm?: number;
  plot_sqm?: number;
  floor?: number;
  total_floors?: number;
  parking?: number;
  furnishing?: string;
  completion?: string;
  ownership?: string;
  available_from?: string;
  handover?: string;
  developer_en?: string;
  year_built?: number;
  service_charge_sqm?: number;
  location?: {
    area_key?: string;
    area_en?: string;
    area_ar?: string;
    city_en?: string;
    community_en?: string;
    community_ar?: string;
    address_en?: string;
    address_ar?: string;
    lat?: number;
    lng?: number;
  };
  amenities?: string[];
  highlights?: string[];
  images: string[];
  videos?: string[];
  floor_plan?: string;
  assigned_agent?: AgentRef | null;
  owner?: PersonRef | null;
  owner_contact?: { name?: string; phone?: string; email?: string };
  internal_notes?: string;
  views: number;
  inquiries?: number;
  created_at: string;
  updated_at: string;
}

export interface ViewingRow {
  _id: string;
  property: PropertyRef;
  lead?: PersonRef | null;
  client?: PersonRef | null;
  assigned_agent: AgentRef;
  scheduled_at: string;
  duration_minutes?: number;
  status: ViewingStatus;
  notes?: string;
  feedback?: string;
  rating?: number;
  reminder_minutes?: number;
  created_at: string;
}

export interface DealRow {
  _id: string;
  title?: string;
  property: PropertyRef & { status?: string };
  client?: PersonRef | null;
  lead?: PersonRef | null;
  assigned_agent: AgentRef;
  type: 'sale' | 'rental';
  status: DealStatus;
  amount: number;
  currency: string;
  commission_percentage?: number;
  commission_amount?: number;
  deal_date?: string;
  closed_at?: string;
  notes?: string;
  documents: { name: string; url: string }[];
  created_at: string;
}

export interface TaskRow {
  _id: string;
  title: string;
  description?: string;
  type: TaskType;
  priority: Priority;
  lead?: PersonRef | null;
  client?: PersonRef | null;
  property?: PropertyRef | null;
  assigned_agent: AgentRef;
  due_at?: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface UserRow {
  _id: string;
  full_name: string;
  full_name_ar?: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  photo?: string;
  role: Role;
  permissions: Permission[];
  revoked_permissions: Permission[];
  is_active: boolean;
  title_en?: string;
  title_ar?: string;
  languages?: string[];
  response_minutes?: number;
  is_superagent?: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface AiSequenceRow {
  _id?: string;
  title: string;
  delay: string;
  message_en?: string;
  message_ar?: string;
  is_active: boolean;
}

export interface CrmSettingsData {
  lead_statuses: LeadStatusOption[];
  lead_sources: SimpleOption[];
  locations: LocationOption[];
  property_types: PropertyTypeOption[];
  ai_config: {
    is_active: boolean;
    smart_replies: boolean;
    lead_scoring: boolean;
    auto_escalation: boolean;
    sequences: AiSequenceRow[];
  };
}

export interface DashboardStats {
  scope: 'mine' | 'all';
  range: '7d' | '30d' | '12m';
  currency: string;
  leads: {
    total: number;
    new: number;
    active: number;
    converted: number;
    lost: number;
    today: number;
    last_30_days: number;
    change_30d: number | null;
    conversion_rate: number | null;
    recent: (Pick<LeadRow, '_id' | 'full_name' | 'status' | 'source' | 'created_at'> & {
      interested_properties: { _id: string; title_en: string }[];
    })[];
  } | null;
  lead_growth: { label: string; count: number }[];
  demand_by_area: { area: string; count: number }[];
  properties: {
    total: number;
    active_listings: number;
    available: number;
    reserved: number;
    rented: number;
    sold: number;
    off_market: number;
    change_30d: number | null;
    by_area: { area: string; count: number }[];
  } | null;
  viewings: { upcoming: number; completed_30d: number; next: ViewingRow[] } | null;
  tasks: { pending: number; overdue: number; lead_follow_ups_due: number; next: TaskRow[] } | null;
  deals: {
    total: number;
    by_status: Record<string, number>;
    open: number;
    pipeline_value: number;
    completed: number;
    revenue: number;
    commission: number;
    this_month: { count: number; revenue: number; commission: number };
  } | null;
  agents:
    | {
        _id: string;
        full_name: string;
        photo: string | null;
        role: Role;
        listings: number;
        leads: number;
        won_leads: number;
        conversion_rate: number | null;
        viewings_completed: number;
        deals_completed: number;
        revenue: number;
        commission: number;
      }[]
    | null;
}
