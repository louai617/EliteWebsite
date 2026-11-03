import "server-only";

/**
 * Small in-memory fixed-window limiter (per server process). Good enough for a single
 * self-hosted instance; swap for a shared store if the CRM is ever scaled horizontally.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterMs: 0 };
  }
  bucket.count += 1;
  return bucket.count > limit ? { ok: false, retryAfterMs: bucket.resetAt - now } : { ok: true, retryAfterMs: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
