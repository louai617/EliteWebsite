import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { VIEWING_STATUSES } from '@/lib/shared/constants';
import { baseSchemaOptions } from './common';

/** A property viewing appointment for a lead and/or client. */
const viewingSchema = new Schema(
  {
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    lead: { type: Schema.Types.ObjectId, ref: 'Lead' },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    assigned_agent: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    /** Date and time of the appointment (stored in UTC). */
    scheduled_at: { type: Date, required: true },
    duration_minutes: { type: Number, min: 5, max: 600, default: 30 },
    status: { type: String, enum: VIEWING_STATUSES, default: 'scheduled' },

    notes: { type: String, trim: true, maxlength: 5000 },
    feedback: { type: String, trim: true, maxlength: 5000 },
    rating: { type: Number, min: 1, max: 5 },

    /** Minutes before `scheduled_at` to remind the agent; empty for no reminder. */
    reminder_minutes: { type: Number, min: 0, max: 10_080 },
    reminder_sent_at: { type: Date },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions
);

viewingSchema.pre('validate', function (this: HydratedDocument<ViewingDoc>) {
  if (!this.lead && !this.client) {
    this.invalidate('lead', 'A viewing needs a lead or a client');
  }
});

viewingSchema.index({ assigned_agent: 1, scheduled_at: 1 });
viewingSchema.index({ status: 1, scheduled_at: 1 });
viewingSchema.index({ property: 1, scheduled_at: -1 });
viewingSchema.index({ lead: 1 });
viewingSchema.index({ client: 1 });

export type ViewingDoc = InferSchemaType<typeof viewingSchema> & { _id: mongoose.Types.ObjectId };

export const Viewing: Model<ViewingDoc> =
  (mongoose.models.Viewing as Model<ViewingDoc>) || mongoose.model<ViewingDoc>('Viewing', viewingSchema);
