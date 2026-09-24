import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { PRIORITIES, PURPOSES } from '@/lib/shared/constants';
import { baseSchemaOptions, EMAIL_REGEX, PHONE_REGEX, phoneDigits } from './common';

/**
 * An enquiry moving through the sales pipeline. `status` and `source` are keys
 * from the configurable lists in Settings.
 *
 * Once a lead is qualified it can be converted into (or linked to) a Client;
 * the lead keeps a reference rather than a copy. Viewings, tasks and deals
 * point back at the lead, so they are looked up, not duplicated here.
 */
const leadSchema = new Schema(
  {
    full_name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, match: PHONE_REGEX },
    phone_digits: { type: String, select: false },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, match: EMAIL_REGEX },
    whatsapp: { type: String, trim: true, match: PHONE_REGEX },

    source: { type: String, required: true, trim: true, maxlength: 60, default: 'website_form' },
    status: { type: String, required: true, trim: true, maxlength: 60, default: 'new' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    assigned_agent: { type: Schema.Types.ObjectId, ref: 'User' },

    interested_properties: [{ type: Schema.Types.ObjectId, ref: 'Property' }],
    purpose: { type: String, enum: PURPOSES },
    property_type: { type: String, trim: true, lowercase: true, maxlength: 60 },
    preferred_location: { type: String, trim: true, maxlength: 120 },
    budget_min: { type: Number, min: 0 },
    budget_max: { type: Number, min: 0 },
    bedrooms: { type: Number, min: 0, max: 50 },
    bathrooms: { type: Number, min: 0, max: 50 },

    /** Message the person typed on the website form. */
    message: { type: String, trim: true, maxlength: 5000 },
    notes: { type: String, trim: true, maxlength: 10_000 },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],

    last_contact_at: { type: Date },
    next_follow_up_at: { type: Date },

    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    /** Public-site account that submitted the enquiry, if signed in. */
    submitted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions
);

leadSchema.pre('validate', function (this: HydratedDocument<LeadDoc>) {
  this.phone_digits = phoneDigits(this.phone) ?? phoneDigits(this.whatsapp);
  if (this.budget_min != null && this.budget_max != null && this.budget_min > this.budget_max) {
    this.invalidate('budget_max', 'Maximum budget must be greater than the minimum budget');
  }
});

leadSchema.index({ status: 1, created_at: -1 });
leadSchema.index({ assigned_agent: 1, status: 1, created_at: -1 });
leadSchema.index({ source: 1, created_at: -1 });
leadSchema.index({ email: 1 });
leadSchema.index({ phone_digits: 1 });
leadSchema.index({ full_name: 1 });
leadSchema.index({ next_follow_up_at: 1 });
leadSchema.index({ client: 1 });
leadSchema.index({ interested_properties: 1 });
leadSchema.index({ submitted_by: 1 });

export type LeadDoc = InferSchemaType<typeof leadSchema> & { _id: mongoose.Types.ObjectId };

export const Lead: Model<LeadDoc> =
  (mongoose.models.Lead as Model<LeadDoc>) || mongoose.model<LeadDoc>('Lead', leadSchema);
