import { z } from 'zod';
import { IMAGE_HOSTS } from '@/lib/shared/constants';

/**
 * Building blocks shared by every API schema.
 *
 * HTML forms send empty strings for blank inputs, so optional fields treat ''
 * as "not provided". On updates, `null` means "clear this field".
 */

const blankToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const optionalObjectId = z.preprocess(blankToNull, objectId.nullable().optional());

export const requiredString = (max: number, label = 'This field') =>
  z.preprocess(
    // A cleared form field arrives as null; report it as "required", not as a type error.
    (v) => (v === null ? '' : v),
    z
      .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
      .trim()
      .min(1, `${label} is required`)
      .max(max, `${label} must be at most ${max} characters`)
  );

export const optionalString = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s\-()]{5,22}$/, 'Enter a valid phone number')
  .refine((v) => {
    const digits = v.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
  }, 'Enter a valid phone number');

export const optionalPhone = z.preprocess(blankToNull, phone.nullable().optional());

export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
export const optionalEmail = z.preprocess(blankToNull, email.nullable().optional());

/** Accepts numbers or numeric strings from form inputs; rejects NaN/negative. */
export const optionalNumber = (opts: { min?: number; max?: number; int?: boolean } = {}) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === 'string') return Number(value);
      return value;
    },
    (() => {
      let n = z.number({ invalid_type_error: 'Must be a number' }).finite();
      if (opts.int) n = n.int('Must be a whole number');
      if (opts.min !== undefined) n = n.min(opts.min, `Must be at least ${opts.min}`);
      if (opts.max !== undefined) n = n.max(opts.max, `Must be at most ${opts.max}`);
      return n.nullable().optional();
    })()
  );

export const requiredNumber = (opts: { min?: number; max?: number; int?: boolean } = {}) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
    (() => {
      let n = z.number({ required_error: 'Required', invalid_type_error: 'Must be a number' }).finite();
      if (opts.int) n = n.int('Must be a whole number');
      if (opts.min !== undefined) n = n.min(opts.min, `Must be at least ${opts.min}`);
      if (opts.max !== undefined) n = n.max(opts.max, `Must be at most ${opts.max}`);
      return n;
    })()
  );

/** ISO date/datetime string (or Date) → Date. Rejects impossible dates. */
export const date = z.preprocess(
  (value) => (typeof value === 'string' || value instanceof Date ? new Date(value) : value),
  z.date({ invalid_type_error: 'Enter a valid date' }).refine((d) => !Number.isNaN(d.getTime()), 'Enter a valid date')
);

export const optionalDate = z.preprocess(
  (value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === null) return null;
    return typeof value === 'string' || value instanceof Date ? new Date(value) : value;
  },
  z
    .date({ invalid_type_error: 'Enter a valid date' })
    .refine((d) => !Number.isNaN(d.getTime()), 'Enter a valid date')
    .nullable()
    .optional()
);

export const settingKey = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores');

export const url = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v) || (v.startsWith('/') && !v.startsWith('//')), 'Must be an http(s) URL');

/** Image URL on an allowed host (see IMAGE_HOSTS), or a site-relative path. */
export const imageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    if (v.startsWith('/') && !v.startsWith('//')) return true;
    try {
      const parsed = new URL(v);
      return parsed.protocol === 'https:' && (IMAGE_HOSTS as readonly string[]).includes(parsed.hostname);
    } catch {
      return false;
    }
  }, `Images must be https URLs from: ${IMAGE_HOSTS.join(', ')}`);

export const stringList = (max: number, itemMax = 60) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value),
    z.array(z.string().trim().min(1).max(itemMax)).max(max)
  );

// ---------------------------------------------------------------------------
// Query-string helpers for list endpoints
// ---------------------------------------------------------------------------

export const pagination = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
};

/** A query param that must be one of the given values; empty means "no filter". */
export const queryEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), z.enum(values).optional());

export const queryObjectId = z.preprocess((v) => (v === '' ? undefined : v), objectId.optional());
export const queryKey = z.preprocess((v) => (v === '' ? undefined : v), settingKey.optional());
export const queryNumber = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : Number(v)),
  z.number().finite().min(0).optional()
);
export const queryBool = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : undefined),
  z.boolean().optional()
);
