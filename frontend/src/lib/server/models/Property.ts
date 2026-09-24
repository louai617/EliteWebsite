import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import {
  COMPLETION,
  FURNISHING,
  OWNERSHIP,
  PRICE_FREQUENCIES,
  PROPERTY_STATUSES,
  PURPOSES,
} from '@/lib/shared/constants';
import { baseSchemaOptions, EMAIL_REGEX, PHONE_REGEX } from './common';

/**
 * A listing. Public-facing fields keep the exact names the website already
 * renders (`title_en`, `location.area_en`, `market.price_history`…) so the
 * listing and detail pages read straight from this document.
 *
 * `type` and `location.area_en` reference the configurable lists in Settings
 * rather than hard-coded enums, so new property types and areas need no deploy.
 */
const propertySchema = new Schema(
  {
    reference_number: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 30,
    },

    title_en: { type: String, required: true, trim: true, maxlength: 200 },
    title_ar: { type: String, trim: true, maxlength: 200 },
    description_en: { type: String, trim: true, maxlength: 10_000 },
    description_ar: { type: String, trim: true, maxlength: 10_000 },

    /** Key from Settings → property types (apartment, villa, office, land…). */
    type: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
    purpose: { type: String, enum: PURPOSES, required: true },
    /** Transaction status: available / reserved / under_offer / rented / sold / off_market. */
    status: { type: String, enum: PROPERTY_STATUSES, default: 'available' },
    /** Published on the public website. */
    is_active: { type: Boolean, default: false },
    is_featured: { type: Boolean, default: false },
    is_verified: { type: Boolean, default: false },
    is_exclusive: { type: Boolean, default: false },

    /** Asking price. For rentals this is the rent per `price_frequency`. */
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'QAR', uppercase: true, trim: true, maxlength: 3 },
    price_frequency: { type: String, enum: PRICE_FREQUENCIES },

    bedrooms: { type: Number, min: 0, max: 50, default: 0 },
    bathrooms: { type: Number, min: 0, max: 50, default: 0 },
    area_sqm: { type: Number, min: 0 },
    plot_sqm: { type: Number, min: 0 },
    floor: { type: Number, min: -5, max: 300 },
    total_floors: { type: Number, min: 0, max: 300 },
    parking: { type: Number, min: 0, max: 100, default: 0 },

    furnishing: { type: String, enum: FURNISHING, default: 'unfurnished' },
    completion: { type: String, enum: COMPLETION, default: 'ready' },
    ownership: { type: String, enum: OWNERSHIP, default: 'freehold' },
    available_from: { type: Date },
    handover: { type: String, trim: true, maxlength: 60 },
    developer_en: { type: String, trim: true, maxlength: 120 },
    developer_ar: { type: String, trim: true, maxlength: 120 },
    year_built: { type: Number, min: 1800, max: 2200 },
    service_charge_sqm: { type: Number, min: 0 },

    location: {
      /** Key from Settings → locations. */
      area_key: { type: String, trim: true, maxlength: 60 },
      area_en: { type: String, trim: true, maxlength: 120 },
      area_ar: { type: String, trim: true, maxlength: 120 },
      city_en: { type: String, trim: true, maxlength: 120 },
      city_ar: { type: String, trim: true, maxlength: 120 },
      community_en: { type: String, trim: true, maxlength: 120 },
      community_ar: { type: String, trim: true, maxlength: 120 },
      address_en: { type: String, trim: true, maxlength: 300 },
      address_ar: { type: String, trim: true, maxlength: 300 },
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },

    amenities: [{ type: String, trim: true, maxlength: 60 }],
    highlights: [{ type: String, trim: true, maxlength: 60 }],
    images: [{ type: String, trim: true, maxlength: 2048 }],
    videos: [{ type: String, trim: true, maxlength: 2048 }],
    floor_plan: { type: String, trim: true, maxlength: 2048 },

    /** Listing broker — also the agent shown on the public page. */
    assigned_agent: { type: Schema.Types.ObjectId, ref: 'User' },
    /** Landlord / seller, when they exist as a CRM client. */
    owner: { type: Schema.Types.ObjectId, ref: 'Client' },
    /** Owner contact for owners who are not (yet) CRM clients. Never shown publicly. */
    owner_contact: {
      name: { type: String, trim: true, maxlength: 120 },
      phone: { type: String, trim: true, match: PHONE_REGEX },
      email: { type: String, trim: true, lowercase: true, match: EMAIL_REGEX },
    },

    /** Optional market data for the public "price trends" section. */
    market: {
      avg_price: { type: Number, min: 0 },
      avg_size_sqm: { type: Number, min: 0 },
      community_listings: { type: Number, min: 0 },
      community_buildings: { type: Number, min: 0 },
      price_history: [
        new Schema(
          { label: String, community: Number, city: Number },
          { _id: false }
        ),
      ],
    },
    nearby: [
      new Schema(
        {
          category: {
            type: String,
            enum: ['school', 'mall', 'beach', 'airport', 'hospital', 'metro', 'landmark'],
          },
          name_en: String,
          name_ar: String,
          minutes: Number,
          mode: { type: String, enum: ['drive', 'walk'] },
        },
        { _id: false }
      ),
    ],
    payment_plan: [
      new Schema(
        {
          key: { type: String, enum: ['booking', 'construction', 'handover', 'post_handover'] },
          percent: Number,
          timing_en: String,
          timing_ar: String,
        },
        { _id: false }
      ),
    ],

    views: { type: Number, default: 0, min: 0 },
    /** When it first went live; drives "listed N days ago". */
    listed_at: { type: Date },
    internal_notes: { type: String, trim: true, maxlength: 5000 },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions
);

// Dashboard & public filters
propertySchema.index({ is_active: 1, is_featured: 1, created_at: -1 });
propertySchema.index({ status: 1, purpose: 1, type: 1 });
propertySchema.index({ assigned_agent: 1, status: 1 });
propertySchema.index({ 'location.area_en': 1 });
propertySchema.index({ 'location.community_en': 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ bedrooms: 1, bathrooms: 1 });
propertySchema.index({ furnishing: 1 });
propertySchema.index({ owner: 1 });

export type PropertyDoc = InferSchemaType<typeof propertySchema> & { _id: mongoose.Types.ObjectId };

export const PropertyModel: Model<PropertyDoc> =
  (mongoose.models.Property as Model<PropertyDoc>) ||
  mongoose.model<PropertyDoc>('Property', propertySchema);
