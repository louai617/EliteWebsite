"use client";

import { formatDateTime, formatRelative } from "@/lib/format";

/**
 * "3 hours ago" with the exact Doha time on hover. Relative text can legitimately differ
 * by a minute between the server render and hydration, so the mismatch is suppressed.
 */
export function RelativeTime({ date, className }: { date: Date | string; className?: string }) {
  return (
    <time dateTime={new Date(date).toISOString()} title={formatDateTime(date)} className={className} suppressHydrationWarning>
      {formatRelative(date)}
    </time>
  );
}
