import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { LANGUAGES, ROLES } from '@/lib/shared/constants';
import { ALL_PERMISSIONS } from '@/lib/shared/permissions';
import { baseSchemaOptions, EMAIL_REGEX, PHONE_REGEX } from './common';

/**
 * Everyone who can sign in: admins, managers, brokers/agents, staff, and
 * public-site customers (`role: 'user'`). Broker-facing profile fields
 * (bilingual name/title, languages, photo) feed the public listing pages.
 */
const userSchema = new Schema(
  {
    full_name: { type: String, required: true, trim: true, maxlength: 120 },
    full_name_ar: { type: String, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: EMAIL_REGEX,
    },
    phone: { type: String, trim: true, match: PHONE_REGEX },
    whatsapp: { type: String, trim: true, match: PHONE_REGEX },
    photo: { type: String, trim: true, maxlength: 2048 },

    role: { type: String, enum: ROLES, required: true, default: 'user' },
    /** Extra permissions on top of the role defaults. */
    permissions: [{ type: String, enum: ALL_PERMISSIONS }],
    /** Role-default permissions taken away from this user. */
    revoked_permissions: [{ type: String, enum: ALL_PERMISSIONS }],
    is_active: { type: Boolean, default: true },

    // Public broker profile
    title_en: { type: String, trim: true, maxlength: 120 },
    title_ar: { type: String, trim: true, maxlength: 120 },
    languages: [{ type: String, enum: LANGUAGES }],
    response_minutes: { type: Number, min: 0, max: 10_000 },
    is_superagent: { type: Boolean, default: false },

    // Credentials — never selected unless explicitly asked for.
    password_hash: { type: String, required: true, select: false },
    /** Bumped on password change / deactivation to invalidate existing sessions. */
    token_version: { type: Number, default: 0, select: false },
    password_reset_hash: { type: String, select: false },
    password_reset_expires: { type: Date, select: false },
    last_login_at: { type: Date },

    /** Public customers: properties they saved on the website. */
    saved_properties: [{ type: Schema.Types.ObjectId, ref: 'Property' }],
  },
  baseSchemaOptions
);

userSchema.index({ role: 1, is_active: 1 });
userSchema.index({ full_name: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>('User', userSchema);

/** Fields safe to send to any authenticated staff member. */
export const USER_PUBLIC_FIELDS =
  '_id full_name full_name_ar email phone whatsapp photo role permissions revoked_permissions is_active title_en title_ar languages response_minutes is_superagent last_login_at created_at updated_at';
