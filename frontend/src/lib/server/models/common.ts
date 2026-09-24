import type { SchemaOptions } from 'mongoose';

/**
 * Field names across the CRM are snake_case, matching the existing front-end
 * data (`full_name`, `reference_number`, `title_en`…). Timestamps follow suit.
 */
export const baseSchemaOptions = {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } as const,
  versionKey: false as const,
} satisfies SchemaOptions;

/** Loose but safe phone check: optional +, 7–15 digits, common separators. */
export const PHONE_REGEX = /^\+?[0-9][0-9\s\-()]{5,22}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Digits only — stored alongside phone numbers so search ignores formatting. */
export function phoneDigits(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  return digits || undefined;
}
