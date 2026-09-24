import { apiHandler, ok, readId } from '@/lib/server/http';
import { PropertyModel } from '@/lib/server/models';
import { clientIp, rateLimit } from '@/lib/server/auth/rateLimit';

/** POST /api/public/properties/:id/view — count a listing view (throttled per visitor). */
export const POST = apiHandler(async (request, context) => {
  const id = await readId(context);
  try {
    rateLimit(`view:${clientIp(request)}:${id}`, 1, 30 * 60_000);
  } catch {
    return ok({ counted: false });
  }
  await PropertyModel.updateOne({ _id: id, is_active: true }, { $inc: { views: 1 } });
  return ok({ counted: true });
});
