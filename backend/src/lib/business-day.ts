/**
 * Business-day arithmetic. A "business date" is a calendar date (YYYY-MM-DD) in the
 * business time zone (APP_TIMEZONE, Asia/Qatar by default). Daily tasks, daily reports and
 * scores are keyed by it, so "today" means the same thing for the server, every browser and
 * the scheduler — whatever the host machine's time zone is.
 *
 * Safe for client and server (no server-only imports).
 */
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { APP_TIMEZONE } from "./format";

export type BusinessDate = string;

/** Weeks start on Sunday (the Qatar work week). 0 = Sunday … 6 = Saturday. */
export const WEEK_START_DAY = 0;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isBusinessDate(value: unknown): value is BusinessDate {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** The business date an instant falls on. */
export function businessDate(at: Date | number = Date.now()): BusinessDate {
  return format(new TZDate(new Date(at).getTime(), APP_TIMEZONE), "yyyy-MM-dd");
}

/** Calendar arithmetic on business dates (no time-zone involvement). */
export function shiftDate(date: BusinessDate, days: number): BusinessDate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The instant a business day starts (midnight in the business time zone). */
export function dayStart(date: BusinessDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, APP_TIMEZONE).getTime());
}

/** [start, end) instants of a business day. */
export function dayRange(date: BusinessDate) {
  return { start: dayStart(date), end: dayStart(shiftDate(date, 1)) };
}

/** A local hour on a business date, e.g. 18:00 → due time of daily tasks. */
export function atLocalHour(date: BusinessDate, hour: number, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, hour, minute, 0, APP_TIMEZONE).getTime());
}

export function weekday(date: BusinessDate) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Inclusive list of dates. */
export function datesBetween(from: BusinessDate, to: BusinessDate): BusinessDate[] {
  const out: BusinessDate[] = [];
  for (let d = from; d <= to && out.length <= 400; d = shiftDate(d, 1)) out.push(d);
  return out;
}

export const RANGE_PRESETS = ["today", "yesterday", "week", "month", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
  custom: "Custom range",
};

export interface DateRange {
  preset: RangePreset;
  from: BusinessDate;
  to: BusinessDate;
}

/** Resolves a preset (or a custom from/to) into an inclusive business-date range. */
export function resolveRange(preset: string | undefined, custom?: { from?: string; to?: string }, now: Date = new Date()): DateRange {
  const today = businessDate(now);
  switch (preset) {
    case "yesterday": {
      const y = shiftDate(today, -1);
      return { preset, from: y, to: y };
    }
    case "week": {
      const back = (weekday(today) - WEEK_START_DAY + 7) % 7;
      return { preset, from: shiftDate(today, -back), to: today };
    }
    case "month":
      return { preset, from: `${today.slice(0, 8)}01`, to: today };
    case "custom": {
      let from = isBusinessDate(custom?.from) ? custom!.from! : today;
      let to = isBusinessDate(custom?.to) ? custom!.to! : today;
      if (from > to) [from, to] = [to, from];
      if (to > today) to = today;
      if (from > today) from = today;
      // Cap custom ranges at ~13 months so reports stay fast.
      if (datesBetween(from, to).length > 400) from = shiftDate(to, -399);
      return { preset, from, to };
    }
    default:
      return { preset: "today", from: today, to: today };
  }
}
