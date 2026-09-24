import { z } from 'zod';
import {
  AMENITIES,
  CLIENT_TYPES,
  COMPLETION,
  DEAL_STATUSES,
  DEAL_TYPES,
  FURNISHING,
  LANGUAGES,
  LEAD_STATUS_CATEGORIES,
  OWNERSHIP,
  PRICE_FREQUENCIES,
  PRIORITIES,
  PROPERTY_STATUSES,
  PURPOSES,
  ROLES,
  TASK_TYPES,
  VIEWING_STATUSES,
} from '@/lib/shared/constants';
import { ALL_PERMISSIONS, type Permission } from '@/lib/shared/permissions';
import {
  date,
  email,
  imageUrl,
  objectId,
  optionalDate,
  optionalEmail,
  optionalNumber,
  optionalObjectId,
  optionalPhone,
  optionalString,
  pagination,
  queryBool,
  queryEnum,
  queryKey,
  queryNumber,
  queryObjectId,
  requiredNumber,
  requiredString,
  settingKey,
  stringList,
  url,
} from './common';

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === '' ? null : v), z.enum(values).nullable().optional());

const optionalKey = z.preprocess((v) => (v === '' ? null : v), settingKey.nullable().optional());
const objectIdList = (max: number) => z.array(objectId).max(max);
const tags = stringList(20, 40).transform((list) => list.map((t) => t.toLowerCase()));

/** "sort" query param: `field` ascending or `-field` descending, from an allow-list. */
const sortParam = (fields: readonly string[], fallback: string) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? fallback : v),
    z.string().refine((v) => fields.includes(v.replace(/^-/, '')), 'Unsupported sort')
  );

const budgetRefine = (value: { budget_min?: number | null; budget_max?: number | null }, ctx: z.RefinementCtx) => {
  if (value.budget_min != null && value.budget_max != null && value.budget_min > value.budget_max) {
    ctx.addIssue({ code: 'custom', path: ['budget_max'], message: 'Maximum budget must be greater than the minimum' });
  }
};

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

const leadBase = z.object({
  full_name: requiredString(120, 'Full name'),
  phone: optionalPhone,
  email: optionalEmail,
  whatsapp: optionalPhone,
  source: optionalKey,
  status: optionalKey,
  priority: optionalEnum(PRIORITIES),
  assigned_agent: optionalObjectId,
  interested_properties: objectIdList(20).optional(),
  purpose: optionalEnum(PURPOSES),
  property_type: optionalKey,
  preferred_location: optionalString(120),
  budget_min: optionalNumber({ min: 0 }),
  budget_max: optionalNumber({ min: 0 }),
  bedrooms: optionalNumber({ min: 0, max: 50, int: true }),
  bathrooms: optionalNumber({ min: 0, max: 50, int: true }),
  message: optionalString(5000),
  notes: optionalString(10_000),
  tags: tags.optional(),
  last_contact_at: optionalDate,
  next_follow_up_at: optionalDate,
  client: optionalObjectId,
});

export const leadCreateSchema = leadBase.superRefine((value, ctx) => {
  budgetRefine(value, ctx);
  if (!value.phone && !value.email && !value.whatsapp) {
    ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Add a phone number, WhatsApp or email' });
  }
});
export const leadUpdateSchema = leadBase.partial().superRefine(budgetRefine);
export type LeadInput = z.infer<typeof leadCreateSchema>;

export const leadListQuery = z.object({
  ...pagination,
  status: queryKey,
  source: queryKey,
  priority: queryEnum(PRIORITIES),
  assigned_agent: z.preprocess((v) => (v === '' ? undefined : v), z.union([objectId, z.literal('unassigned'), z.literal('me')]).optional()),
  property: queryObjectId,
  client: queryObjectId,
  follow_up_due: queryBool,
  sort: sortParam(['created_at', 'full_name', 'next_follow_up_at', 'last_contact_at', 'budget_max'], '-created_at'),
});

/** Website enquiry form (public, unauthenticated). */
export const publicLeadSchema = z
  .object({
    full_name: requiredString(120, 'Full name').pipe(z.string().min(3, 'Name is required')),
    email: email,
    phone: optionalPhone,
    message: requiredString(5000, 'Message').pipe(z.string().min(10, 'Message must be at least 10 characters')),
    propertyId: z.preprocess((v) => (v === '' ? undefined : v), objectId.optional()),
    /** Honeypot: real users never fill this hidden field. */
    website: z.string().max(0).optional(),
  })
  .strip();

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const clientBase = z.object({
  full_name: requiredString(120, 'Full name'),
  types: z.array(z.enum(CLIENT_TYPES)).min(1, 'Choose at least one client type').max(CLIENT_TYPES.length),
  phone: optionalPhone,
  email: optionalEmail,
  whatsapp: optionalPhone,
  nationality: optionalString(60),
  company: optionalString(120),
  preferred_locations: stringList(20, 120).optional(),
  requirements: z
    .object({
      purpose: optionalEnum(PURPOSES),
      property_types: z.array(settingKey).max(20).optional(),
      bedrooms_min: optionalNumber({ min: 0, max: 50, int: true }),
      bathrooms_min: optionalNumber({ min: 0, max: 50, int: true }),
      furnishing: optionalEnum(FURNISHING),
      notes: optionalString(2000),
    })
    .partial()
    .optional(),
  budget_min: optionalNumber({ min: 0 }),
  budget_max: optionalNumber({ min: 0 }),
  currency: z.string().trim().toUpperCase().length(3).optional(),
  notes: optionalString(10_000),
  tags: tags.optional(),
  assigned_agent: optionalObjectId,
});

export const clientCreateSchema = clientBase.superRefine((value, ctx) => {
  budgetRefine(value, ctx);
  if (!value.phone && !value.email && !value.whatsapp) {
    ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Add a phone number, WhatsApp or email' });
  }
});
export const clientUpdateSchema = clientBase.partial().superRefine(budgetRefine);
export type ClientInput = z.infer<typeof clientCreateSchema>;

export const clientListQuery = z.object({
  ...pagination,
  type: queryEnum(CLIENT_TYPES),
  assigned_agent: z.preprocess((v) => (v === '' ? undefined : v), z.union([objectId, z.literal('unassigned'), z.literal('me')]).optional()),
  sort: sortParam(['created_at', 'full_name', 'budget_max'], '-created_at'),
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

const propertyBase = z.object({
  reference_number: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().toUpperCase().max(30).regex(/^[A-Z0-9-]+$/, 'Letters, numbers and dashes only').optional()
  ),
  title_en: requiredString(200, 'Title'),
  title_ar: optionalString(200),
  description_en: optionalString(10_000),
  description_ar: optionalString(10_000),
  type: settingKey,
  purpose: z.enum(PURPOSES),
  status: z.enum(PROPERTY_STATUSES).optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  is_verified: z.boolean().optional(),
  is_exclusive: z.boolean().optional(),

  price: requiredNumber({ min: 0 }),
  currency: z.string().trim().toUpperCase().length(3).optional(),
  price_frequency: optionalEnum(PRICE_FREQUENCIES),

  bedrooms: optionalNumber({ min: 0, max: 50, int: true }),
  bathrooms: optionalNumber({ min: 0, max: 50, int: true }),
  area_sqm: optionalNumber({ min: 0 }),
  plot_sqm: optionalNumber({ min: 0 }),
  floor: optionalNumber({ min: -5, max: 300, int: true }),
  total_floors: optionalNumber({ min: 0, max: 300, int: true }),
  parking: optionalNumber({ min: 0, max: 100, int: true }),

  furnishing: z.enum(FURNISHING).optional(),
  completion: z.enum(COMPLETION).optional(),
  ownership: z.enum(OWNERSHIP).optional(),
  available_from: optionalDate,
  handover: optionalString(60),
  developer_en: optionalString(120),
  developer_ar: optionalString(120),
  year_built: optionalNumber({ min: 1800, max: 2200, int: true }),
  service_charge_sqm: optionalNumber({ min: 0 }),

  location: z
    .object({
      area_key: optionalKey,
      community_en: optionalString(120),
      community_ar: optionalString(120),
      address_en: optionalString(300),
      address_ar: optionalString(300),
      lat: optionalNumber({ min: -90, max: 90 }),
      lng: optionalNumber({ min: -180, max: 180 }),
    })
    .partial()
    .optional(),

  amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length).optional(),
  highlights: z.array(settingKey).max(20).optional(),
  images: z.array(imageUrl).max(40).optional(),
  videos: z.array(url).max(10).optional(),
  floor_plan: z.preprocess((v) => (v === '' ? null : v), imageUrl.nullable().optional()),

  assigned_agent: optionalObjectId,
  owner: optionalObjectId,
  owner_contact: z
    .object({ name: optionalString(120), phone: optionalPhone, email: optionalEmail })
    .partial()
    .optional(),
  internal_notes: optionalString(5000),
});

const rentNeedsFrequency = (
  value: { purpose?: string; price_frequency?: string | null },
  ctx: z.RefinementCtx
) => {
  if (value.purpose === 'rent' && !value.price_frequency) {
    ctx.addIssue({ code: 'custom', path: ['price_frequency'], message: 'Rentals need a rent frequency (monthly or yearly)' });
  }
};

export const propertyCreateSchema = propertyBase.superRefine(rentNeedsFrequency);
export const propertyUpdateSchema = propertyBase.partial();
export type PropertyInput = z.infer<typeof propertyCreateSchema>;

export const propertyListQuery = z.object({
  ...pagination,
  location: z.string().trim().max(120).optional(),
  type: queryKey,
  purpose: queryEnum(PURPOSES),
  status: queryEnum(PROPERTY_STATUSES),
  furnishing: queryEnum(FURNISHING),
  is_active: queryBool,
  is_featured: queryBool,
  price_min: queryNumber,
  price_max: queryNumber,
  bedrooms: queryNumber,
  bathrooms: queryNumber,
  assigned_agent: z.preprocess((v) => (v === '' ? undefined : v), z.union([objectId, z.literal('unassigned'), z.literal('me')]).optional()),
  owner: queryObjectId,
  sort: sortParam(['created_at', 'price', 'views', 'title_en', 'reference_number'], '-created_at'),
});

// ---------------------------------------------------------------------------
// Viewings
// ---------------------------------------------------------------------------

const viewingBase = z.object({
  property: objectId,
  lead: optionalObjectId,
  client: optionalObjectId,
  assigned_agent: optionalObjectId,
  scheduled_at: date,
  duration_minutes: optionalNumber({ min: 5, max: 600, int: true }),
  status: z.enum(VIEWING_STATUSES).optional(),
  notes: optionalString(5000),
  feedback: optionalString(5000),
  rating: optionalNumber({ min: 1, max: 5, int: true }),
  reminder_minutes: optionalNumber({ min: 0, max: 10_080, int: true }),
});

export const viewingCreateSchema = viewingBase.superRefine((value, ctx) => {
  if (!value.lead && !value.client) {
    ctx.addIssue({ code: 'custom', path: ['lead'], message: 'Choose a lead or a client for the viewing' });
  }
});
export const viewingUpdateSchema = viewingBase.partial();

export const viewingListQuery = z.object({
  ...pagination,
  status: queryEnum(VIEWING_STATUSES),
  assigned_agent: z.preprocess((v) => (v === '' ? undefined : v), z.union([objectId, z.literal('me')]).optional()),
  property: queryObjectId,
  lead: queryObjectId,
  client: queryObjectId,
  from: optionalDate,
  to: optionalDate,
  upcoming: queryBool,
  sort: sortParam(['scheduled_at', 'created_at'], 'scheduled_at'),
});

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

const dealBase = z.object({
  title: optionalString(200),
  property: objectId,
  client: optionalObjectId,
  lead: optionalObjectId,
  assigned_agent: optionalObjectId,
  type: z.enum(DEAL_TYPES),
  status: z.enum(DEAL_STATUSES).optional(),
  amount: requiredNumber({ min: 0 }),
  currency: z.string().trim().toUpperCase().length(3).optional(),
  commission_percentage: optionalNumber({ min: 0, max: 100 }),
  commission_amount: optionalNumber({ min: 0 }),
  deal_date: optionalDate,
  notes: optionalString(10_000),
  documents: z.array(z.object({ name: requiredString(200, 'Document name'), url })).max(30).optional(),
});

export const dealCreateSchema = dealBase.superRefine((value, ctx) => {
  if (!value.client && !value.lead) {
    ctx.addIssue({ code: 'custom', path: ['client'], message: 'Choose a client or a lead for the deal' });
  }
});
export const dealUpdateSchema = dealBase.partial();

export const dealListQuery = z.object({
  ...pagination,
  status: queryEnum(DEAL_STATUSES),
  type: queryEnum(DEAL_TYPES),
  assigned_agent: z.preprocess((v) => (v === '' ? undefined : v), z.union([objectId, z.literal('me')]).optional()),
  property: queryObjectId,
  client: queryObjectId,
  lead: queryObjectId,
  sort: sortParam(['deal_date', 'created_at', 'amount', 'commission_amount'], '-created_at'),
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const taskBase = z.object({
  title: requiredString(200, 'Title'),
  description: optionalString(5000),
  type: z.enum(TASK_TYPES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  lead: optionalObjectId,
  client: optionalObjectId,
  property: optionalObjectId,
  assigned_agent: optionalObjectId,
  due_at: optionalDate,
  completed: z.boolean().optional(),
});

export const taskCreateSchema = taskBase;
export const taskUpdateSchema = taskBase.partial();

export const taskListQuery = z.object({
  ...pagination,
  type: queryEnum(TASK_TYPES),
  priority: queryEnum(PRIORITIES),
  completed: queryBool,
  overdue: queryBool,
  assigned_agent: z.preprocess((v) => (v === '' ? undefined : v), z.union([objectId, z.literal('me')]).optional()),
  lead: queryObjectId,
  client: queryObjectId,
  sort: sortParam(['due_at', 'created_at', 'priority'], 'due_at'),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and at least one number');

const userBase = z.object({
  full_name: requiredString(120, 'Full name'),
  full_name_ar: optionalString(120),
  email,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  photo: z.preprocess((v) => (v === '' ? null : v), imageUrl.nullable().optional()),
  role: z.enum(ROLES),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]])).max(ALL_PERMISSIONS.length).optional(),
  revoked_permissions: z.array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]])).max(ALL_PERMISSIONS.length).optional(),
  is_active: z.boolean().optional(),
  title_en: optionalString(120),
  title_ar: optionalString(120),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length).optional(),
  response_minutes: optionalNumber({ min: 0, max: 10_000, int: true }),
  is_superagent: z.boolean().optional(),
});

export const userCreateSchema = userBase.extend({ password: passwordSchema });
export const userUpdateSchema = userBase.partial().extend({ password: passwordSchema.optional() });

export const userListQuery = z.object({
  ...pagination,
  role: queryEnum(ROLES),
  is_active: queryBool,
  staff: queryBool,
  sort: sortParam(['full_name', 'created_at', 'role', 'last_login_at'], 'full_name'),
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});

export const registerSchema = z.object({
  full_name: requiredString(120, 'Full name').pipe(z.string().min(3, 'Full name is required')),
  email,
  phone: optionalPhone,
  password: passwordSchema,
});

export const profileUpdateSchema = z.object({
  full_name: requiredString(120, 'Full name').optional(),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  photo: z.preprocess((v) => (v === '' ? null : v), imageUrl.nullable().optional()),
  current_password: z.string().max(128).optional(),
  new_password: passwordSchema.optional(),
});

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid or expired reset link'),
  password: passwordSchema,
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const uniqueKeys = <T extends { key: string }>(list: T[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>();
  list.forEach((item, index) => {
    if (seen.has(item.key)) ctx.addIssue({ code: 'custom', path: [index, 'key'], message: `Duplicate key "${item.key}"` });
    seen.add(item.key);
  });
};

export const settingsUpdateSchema = z.object({
  lead_statuses: z
    .array(
      z.object({
        key: settingKey,
        label: requiredString(60, 'Label'),
        category: z.enum(LEAD_STATUS_CATEGORIES),
        color: z.string().trim().max(20).regex(/^[a-z]+$/).optional(),
      })
    )
    .min(1)
    .max(30)
    .superRefine(uniqueKeys)
    .refine((list) => list.some((s) => s.category === 'open'), 'Keep at least one open status')
    .optional(),
  lead_sources: z
    .array(z.object({ key: settingKey, label: requiredString(60, 'Label') }))
    .min(1)
    .max(50)
    .superRefine(uniqueKeys)
    .optional(),
  locations: z
    .array(
      z.object({
        key: settingKey,
        name_en: requiredString(80, 'Name'),
        name_ar: optionalString(80),
        city_en: optionalString(80),
        city_ar: optionalString(80),
      })
    )
    .min(1)
    .max(300)
    .superRefine(uniqueKeys)
    .optional(),
  property_types: z
    .array(z.object({ key: settingKey, label_en: requiredString(60, 'Label'), label_ar: optionalString(60) }))
    .min(1)
    .max(50)
    .superRefine(uniqueKeys)
    .optional(),
  ai_config: z
    .object({
      is_active: z.boolean(),
      smart_replies: z.boolean(),
      lead_scoring: z.boolean(),
      auto_escalation: z.boolean(),
      sequences: z
        .array(
          z.object({
            _id: z.preprocess((v) => (v === '' ? undefined : v), objectId.optional()),
            title: requiredString(120, 'Title'),
            delay: requiredString(40, 'Delay'),
            message_en: optionalString(2000),
            message_ar: optionalString(2000),
            is_active: z.boolean(),
          })
        )
        .max(20),
    })
    .optional(),
});
