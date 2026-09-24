import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { DEAL_STATUSES, DEAL_TYPES } from '@/lib/shared/constants';
import { baseSchemaOptions } from './common';

/** A sale or rental transaction and the commission it earns. */
const dealSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 200 },
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    lead: { type: Schema.Types.ObjectId, ref: 'Lead' },
    assigned_agent: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    type: { type: String, enum: DEAL_TYPES, required: true },
    status: { type: String, enum: DEAL_STATUSES, default: 'negotiation' },

    /** Sale price, or total contract rent for rentals. */
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'QAR', uppercase: true, maxlength: 3 },
    commission_percentage: { type: Number, min: 0, max: 100 },
    commission_amount: { type: Number, min: 0 },

    deal_date: { type: Date },
    closed_at: { type: Date },
    notes: { type: String, trim: true, maxlength: 10_000 },
    /** Contract / ID documents (URLs — uploads can plug in here later). */
    documents: [
      new Schema(
        {
          name: { type: String, required: true, trim: true, maxlength: 200 },
          url: { type: String, required: true, trim: true, maxlength: 2048 },
        },
        { _id: false }
      ),
    ],
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions
);

dealSchema.pre('validate', function (this: HydratedDocument<DealDoc>) {
  // Derive the commission amount from the percentage when it was not given explicitly.
  if (this.commission_amount == null && this.commission_percentage != null && this.amount != null) {
    this.commission_amount = Math.round((this.amount * this.commission_percentage) / 100);
  }
  if (!this.client && !this.lead) {
    this.invalidate('client', 'A deal needs a client or a lead');
  }
});

dealSchema.index({ status: 1, deal_date: -1 });
dealSchema.index({ assigned_agent: 1, status: 1 });
dealSchema.index({ property: 1 });
dealSchema.index({ client: 1 });
dealSchema.index({ lead: 1 });

export type DealDoc = InferSchemaType<typeof dealSchema> & { _id: mongoose.Types.ObjectId };

export const Deal: Model<DealDoc> =
  (mongoose.models.Deal as Model<DealDoc>) || mongoose.model<DealDoc>('Deal', dealSchema);
