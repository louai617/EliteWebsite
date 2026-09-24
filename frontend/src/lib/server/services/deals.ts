import 'server-only';
import type mongoose from 'mongoose';
import { Lead, PropertyModel } from '../models';
import { getSettings, statusKeysByCategory } from './settings';

export const DEAL_POPULATE = [
  { path: 'property', select: 'title_en reference_number purpose status location.area_en images' },
  { path: 'client', select: 'full_name phone email' },
  { path: 'lead', select: 'full_name status' },
  { path: 'assigned_agent', select: 'full_name photo' },
];

/**
 * Keep related records consistent with a deal's status:
 *  - completed  → property sold/rented, lead moved to the first "won" status
 *  - reserved/contracted → property reserved/under offer (if still available)
 */
export async function syncDealSideEffects(deal: {
  status?: string | null;
  type?: string | null;
  property?: mongoose.Types.ObjectId | null;
  lead?: mongoose.Types.ObjectId | null;
}) {
  if (!deal.property) return;

  if (deal.status === 'completed') {
    await PropertyModel.updateOne(
      { _id: deal.property },
      { $set: { status: deal.type === 'rental' ? 'rented' : 'sold' } }
    );
    if (deal.lead) {
      const wonStatus = statusKeysByCategory(await getSettings(), 'won')[0];
      if (wonStatus) await Lead.updateOne({ _id: deal.lead }, { $set: { status: wonStatus } });
    }
  } else if (deal.status === 'reserved' || deal.status === 'contracted') {
    await PropertyModel.updateOne(
      { _id: deal.property, status: 'available' },
      { $set: { status: deal.status === 'reserved' ? 'reserved' : 'under_offer' } }
    );
  }
}
