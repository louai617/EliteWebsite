import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/constants";
import { parseZonedInput } from "@/lib/format";

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const value = sp[key];
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

export function enumParam<T extends string>(sp: SearchParams, key: string, values: Record<string, T>): T | undefined {
  const raw = param(sp, key);
  return raw && (Object.values(values) as string[]).includes(raw) ? (raw as T) : undefined;
}

export function intParam(sp: SearchParams, key: string, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}): number | undefined {
  const raw = param(sp, key);
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

export function dateParam(sp: SearchParams, key: string): Date | undefined {
  const raw = param(sp, key);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = parseZonedInput(raw);
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : undefined;
}

export interface ListParams<S extends string> {
  page: number;
  pageSize: number;
  q?: string;
  sort: S;
  dir: "asc" | "desc";
}

/** Pagination + search + whitelisted sorting, with safe fallbacks for bad URLs. */
export function listParams<S extends string>(
  sp: SearchParams,
  sortable: readonly S[],
  defaults: { sort: S; dir?: "asc" | "desc" },
): ListParams<S> {
  const size = intParam(sp, "size");
  const sort = param(sp, "sort") as S | undefined;
  const dir = param(sp, "dir");
  return {
    page: intParam(sp, "page", { min: 1, max: 100_000 }) ?? 1,
    pageSize: size && (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
    q: param(sp, "q")?.slice(0, 100),
    sort: sort && sortable.includes(sort) ? sort : defaults.sort,
    dir: dir === "asc" || dir === "desc" ? dir : (defaults.dir ?? "desc"),
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export const skipTake = (page: number, pageSize: number) => ({ skip: (page - 1) * pageSize, take: pageSize });
