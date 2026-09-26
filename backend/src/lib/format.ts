import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format, formatDistanceToNowStrict } from "date-fns";

/**
 * The CRM runs on Doha time. Every date is formatted (and every date typed into a form is
 * interpreted) in this zone explicitly, so the server render, the browser and the database
 * always agree — regardless of the host or the viewer's machine time zone.
 */
export const APP_TIMEZONE = "Asia/Qatar";

const inZone = (date: Date | string | number) => new TZDate(new Date(date).getTime(), APP_TIMEZONE);

/** Doha-time "now". */
export const zonedNow = () => TZDate.tz(APP_TIMEZONE);

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number | null | undefined, currency = "QAR") {
  if (amount === null || amount === undefined) return "—";
  let fmt = moneyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-QA", { style: "currency", currency, maximumFractionDigits: 0 });
    moneyFormatters.set(currency, fmt);
  }
  return fmt.format(amount);
}

const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** "QAR 1.2M" — for dense tables and chart axes. */
export function formatMoneyCompact(amount: number | null | undefined, currency = "QAR") {
  if (amount === null || amount === undefined) return "—";
  return `${currency} ${compactFmt.format(amount)}`;
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en").format(value);
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return format(inZone(date), "d MMM yyyy");
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return format(inZone(date), "d MMM yyyy, HH:mm");
}

export function formatTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return format(inZone(date), "HH:mm");
}

/** Pattern-based format in Doha time (e.g. "EEEE d MMMM", "MMM"). */
export function formatZoned(date: Date | string, pattern: string) {
  return format(inZone(date), pattern);
}

/** Calendar-day difference in Doha time (0 = today, 1 = tomorrow, -1 = yesterday). */
export function dayOffset(date: Date | string) {
  return differenceInCalendarDays(inZone(date), zonedNow());
}

/** "Today", "Tomorrow", "Yesterday", or "Mon 12 May". */
export function formatDayLabel(date: Date | string) {
  const offset = dayOffset(date);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  return format(inZone(date), "EEE d MMM");
}

export function formatRelative(date: Date | string | null | undefined) {
  if (!date) return "—";
  if (Math.abs(dayOffset(date)) > 6) return formatDate(date);
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}

/** Value for <input type="date"> (Doha calendar day). */
export function toDateInput(date: Date | string | null | undefined) {
  return date ? format(inZone(date), "yyyy-MM-dd") : "";
}

/** Value for <input type="datetime-local"> (Doha wall-clock time). */
export function toDateTimeInput(date: Date | string | null | undefined) {
  return date ? format(inZone(date), "yyyy-MM-dd'T'HH:mm") : "";
}

/**
 * Parses the value of a date / datetime-local input as Doha time. Strings with an explicit
 * offset (ISO) and Date objects pass through unchanged.
 */
export function parseZonedInput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return value;
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  return new Date(new TZDate(+y, +mo - 1, +d, +h, +mi, +s, APP_TIMEZONE).getTime());
}

/** Start of a Doha calendar day, `offsetDays` from today. */
export function zonedDayStart(offsetDays = 0) {
  const now = zonedNow();
  return new Date(new TZDate(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, APP_TIMEZONE).getTime());
}

/** Start of a Doha calendar month, `offsetMonths` from this month. */
export function zonedMonthStart(offsetMonths = 0) {
  const now = zonedNow();
  return new Date(new TZDate(now.getFullYear(), now.getMonth() + offsetMonths, 1, APP_TIMEZONE).getTime());
}

/** True when the date is before "now" (kept out of components so renders stay pure). */
export function isInPast(date: Date | string) {
  return new Date(date).getTime() < Date.now();
}
