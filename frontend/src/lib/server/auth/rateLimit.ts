import 'server-only';
import type { NextRequest } from 'next/server';
import { tooManyRequests } from '../http';

/**
 * Small fixed-window rate limiter for login, registration and the public lead
 * form. State is per server instance (in memory) — enough to blunt password
 * guessing and form spam. For multi-instance deployments, back this with a
 * shared store such as Upstash Redis.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    bucket.count += 1;
    if (bucket.count > limit) throw tooManyRequests();
  }

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
}
