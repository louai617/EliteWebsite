import mongoose from 'mongoose';
import { z } from 'zod';
import { apiHandler, notFound, ok, readBody } from '@/lib/server/http';
import { PropertyModel, User } from '@/lib/server/models';
import { requireAuth } from '@/lib/server/auth/session';
import { objectId } from '@/lib/validation/common';

const bodySchema = z.object({ propertyId: objectId });

/** GET — ids of the signed-in user's saved listings. */
export const GET = apiHandler(async (request) => {
  const auth = await requireAuth(request);
  const user = await User.findById(auth.id).select('saved_properties').lean();
  return ok({ ids: (user?.saved_properties ?? []).map(String) });
});

/** POST { propertyId } — save a published listing. */
export const POST = apiHandler(async (request) => {
  const auth = await requireAuth(request);
  const { propertyId } = await readBody(request, bodySchema);
  const id = new mongoose.Types.ObjectId(propertyId);
  if (!(await PropertyModel.exists({ _id: id, is_active: true }))) throw notFound('Property');

  await User.updateOne({ _id: auth.id }, { $addToSet: { saved_properties: id } });
  return ok({ saved: true });
});

/** DELETE { propertyId } — remove a saved listing. */
export const DELETE = apiHandler(async (request) => {
  const auth = await requireAuth(request);
  const { propertyId } = await readBody(request, bodySchema);
  await User.updateOne({ _id: auth.id }, { $pull: { saved_properties: new mongoose.Types.ObjectId(propertyId) } });
  return ok({ saved: false });
});
