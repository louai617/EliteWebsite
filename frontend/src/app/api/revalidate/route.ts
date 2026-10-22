import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';

/**
 * POST /api/revalidate — called by the CRM (agent app) whenever a listing changes, so the
 * website shows it immediately. Requires `Authorization: Bearer <REVALIDATE_SECRET>`; the same
 * value is WEBSITE_REVALIDATE_SECRET in the CRM. Server-side only; never exposed to browsers.
 */
const SECRET = process.env.REVALIDATE_SECRET?.trim() ?? '';
const ALLOWED_TAGS = new Set(['listings']);

function authorized(request: Request) {
  if (!SECRET) return false;
  const given = Buffer.from((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!SECRET) return Response.json({ ok: false, error: 'Revalidation is not configured (REVALIDATE_SECRET).' }, { status: 404 });
  if (!authorized(request)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  let tags: string[] = ['listings'];
  try {
    const body = (await request.json()) as { tags?: unknown };
    if (Array.isArray(body.tags)) tags = body.tags.filter((t): t is string => typeof t === 'string' && ALLOWED_TAGS.has(t));
  } catch {
    // No body: refresh the listings.
  }
  // Expire immediately so the very next visitor sees the change.
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ ok: true, revalidated: tags, at: new Date().toISOString() });
}
