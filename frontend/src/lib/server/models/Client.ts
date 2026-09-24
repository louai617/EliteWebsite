import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { CLIENT_TYPES, FURNISHING, PURPOSES } from '@/lib/shared/constants';
import { baseSchemaOptions, EMAIL_REGEX, PHONE_REGEX, phoneDigits } from './common';

/**
 * A known person or company the business deals with — tenant, buyer,
 * landlord, seller, investor (one client can be several of these).
 *
 * Related records are NOT copied onto the client: leads reference it via
 * `lead.client`, owned listings via `property.owner`, and viewings/deals/tasks
 * via their own `client` field. The client detail endpoint looks them up.
 */
const clientSchema = new Schema(
  {
    full_name: { type: String, required: true, trim: true, maxlength: 120 },
    types: {
      type: [{ type: String, enum: CLIENT_TYPES }],
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        message: 'Choose at least one client type',
      },
    },
    phone: { type: String, trim: true, match: PHONE_REGEX },
    phone_digits: { type: String, select: false },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, match: EMAIL_REGEX },
    whatsapp: { type: String, trim: true, match: PHONE_REGEX },
    nationality: { type: String, trim: true, maxlength: 60 },
    company: { type: String, trim: true, maxlength: 120 },

    preferred_locations: [{ type: String, trim: true, maxlength: 120 }],
    requirements: {
      purpose: { type: String, enum: PURPOSES },
      property_types: [{ type: String, trim: true, lowercase: true, maxlength: 60 }],
      bedrooms_min: { type: Number, min: 0, max: 50 },
      bathrooms_min: { type: Number, min: 0, max: 50 },
      furnishing: { type: String, enum: FURNISHING },
      notes: { type: String, trim: true, maxlength: 2000 },
    },
    budget_min: { type: Number, min: 0 },
    budget_max: { type: Number, min: 0 },
    currency: { type: String, default: 'QAR', uppercase: true, maxlength: 3 },

    notes: { type: String, trim: true, maxlength: 10_000 },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
    assigned_agent: { type: Schema.Types.ObjectId, ref: 'User' },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions
);

clientSchema.pre('validate', function (this: HydratedDocument<ClientDoc>) {
  this.phone_digits = phoneDigits(this.phone) ?? phoneDigits(this.whatsapp);
  if (this.budget_min != null && this.budget_max != null && this.budget_min > this.budget_max) {
    this.invalidate('budget_max', 'Maximum budget must be greater than the minimum budget');
  }
});

clientSchema.index({ assigned_agent: 1, created_at: -1 });
clientSchema.index({ types: 1 });
clientSchema.index({ full_name: 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ phone_digits: 1 });

export type ClientDoc = InferSchemaType<typeof clientSchema> & { _id: mongoose.Types.ObjectId };

export const Client: Model<ClientDoc> =
  (mongoose.models.Client as Model<ClientDoc>) || mongoose.model<ClientDoc>('Client', clientSchema);
