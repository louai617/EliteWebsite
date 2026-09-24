import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { LEAD_STATUS_CATEGORIES } from '@/lib/shared/constants';
import { baseSchemaOptions } from './common';

/**
 * Single-document CRM configuration (`key: 'crm'`). Lead statuses, sources,
 * locations and property types are data, not code, so the business can change
 * them without a deploy. The AI follow-up configuration lives here too.
 */
const keyField = { type: String, required: true, trim: true, maxlength: 60, match: /^[a-z0-9_]+$/ };

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'crm' },

    lead_statuses: [
      new Schema(
        {
          key: keyField,
          label: { type: String, required: true, trim: true, maxlength: 60 },
          category: { type: String, enum: LEAD_STATUS_CATEGORIES, required: true },
          color: { type: String, trim: true, maxlength: 20, default: 'gray' },
        },
        { _id: false }
      ),
    ],
    lead_sources: [
      new Schema(
        { key: keyField, label: { type: String, required: true, trim: true, maxlength: 60 } },
        { _id: false }
      ),
    ],
    locations: [
      new Schema(
        {
          key: keyField,
          name_en: { type: String, required: true, trim: true, maxlength: 80 },
          name_ar: { type: String, trim: true, maxlength: 80 },
          city_en: { type: String, trim: true, maxlength: 80 },
          city_ar: { type: String, trim: true, maxlength: 80 },
        },
        { _id: false }
      ),
    ],
    property_types: [
      new Schema(
        {
          key: keyField,
          label_en: { type: String, required: true, trim: true, maxlength: 60 },
          label_ar: { type: String, trim: true, maxlength: 60 },
        },
        { _id: false }
      ),
    ],

    ai_config: {
      is_active: { type: Boolean, default: true },
      smart_replies: { type: Boolean, default: true },
      lead_scoring: { type: Boolean, default: true },
      auto_escalation: { type: Boolean, default: false },
      sequences: [
        new Schema(
          {
            title: { type: String, required: true, trim: true, maxlength: 120 },
            delay: { type: String, required: true, trim: true, maxlength: 40 },
            message_en: { type: String, trim: true, maxlength: 2000 },
            message_ar: { type: String, trim: true, maxlength: 2000 },
            is_active: { type: Boolean, default: true },
          },
          { _id: true }
        ),
      ],
    },
  },
  baseSchemaOptions
);

export type SettingDoc = InferSchemaType<typeof settingSchema> & { _id: mongoose.Types.ObjectId };

export const Setting: Model<SettingDoc> =
  (mongoose.models.Setting as Model<SettingDoc>) || mongoose.model<SettingDoc>('Setting', settingSchema);
