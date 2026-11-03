"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney, formatMoneyCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Dependency-free, single-series charts in the brand gold (#a8823a — validated ≥3:1 on
 * the card surface). Specs: columns ≤24px with a 4px rounded data-end, hairline grid,
 * selective direct labels (peak + latest), per-mark hover tooltip, and a screen-reader
 * table so values are never colour- or hover-only.
 */
const SERIES = "#a8823a";

function niceMax(value: number) {
  if (value <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= value) ?? pow * 10;
  return step * 4;
}

export interface ColumnPoint {
  key: string;
  label: string;
  value: number;
  /** Extra tooltip lines, e.g. "3 deals". */
  details?: string[];
}

/** Formatting presets (functions can't cross the server → client boundary). */
const FORMATS = {
  money: { value: (n: number) => formatMoney(n), tick: (n: number) => formatMoneyCompact(n).replace("QAR ", "") },
  count: { value: (n: number) => formatNumber(n), tick: (n: number) => formatNumber(n) },
};

export function ColumnChart({
  points,
  format = "count",
  caption,
  valueLabel,
  height = 200,
}: {
  points: ColumnPoint[];
  format?: keyof typeof FORMATS;
  caption: string;
  valueLabel: string;
  height?: number;
}) {
  const formatValue = FORMATS[format].value;
  const formatTick = FORMATS[format].tick;
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const last = points.length - 1;

  return (
    <figure className="w-full">
      <div className="flex gap-2" style={{ height }}>
        <div className="flex w-12 shrink-0 flex-col-reverse justify-between pb-6 text-right text-[11px] text-muted-foreground tabular">
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {formatTick(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col-reverse justify-between" aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="h-px bg-border/70" />
            ))}
          </div>
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end">
            {points.map((p, i) => {
              const h = max ? (p.value / max) * 100 : 0;
              const labelled = p.value > 0 && (i === peak || i === last) && hover !== i;
              return (
                <div
                  key={p.key}
                  className="relative flex h-full flex-1 items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${p.label}: ${formatValue(p.value)}`}
                >
                  {labelled && (
                    <span className="tabular absolute text-[11px] font-medium text-foreground" style={{ bottom: `calc(${h}% + 4px)` }}>
                      {formatTick(p.value)}
                    </span>
                  )}
                  <div
                    className="w-full max-w-6 rounded-t-[4px] transition-opacity"
                    style={{ height: `${h}%`, minHeight: p.value > 0 ? 2 : 0, background: SERIES, opacity: hover === null || hover === i ? 1 : 0.4 }}
                  />
                  {hover === i && (
                    <div className="pointer-events-none absolute z-10 -translate-y-2 rounded-md bg-primary px-2.5 py-1.5 text-xs whitespace-nowrap text-primary-foreground shadow-lg" style={{ bottom: `${h}%` }}>
                      <p className="opacity-70">{p.label}</p>
                      <p className="tabular font-semibold">
                        {formatValue(p.value)} {valueLabel}
                      </p>
                      {p.details?.map((d) => (
                        <p key={d} className="opacity-80">
                          {d}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-5">
            {points.map((p) => (
              <span key={p.key} className="flex-1 text-center text-[11px] text-muted-foreground">
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="sr-only">
        <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <td>{p.label}</td>
              <td>{formatValue(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  href?: string;
}

/** Horizontal bars with the value at the tip. */
export function BarList({ rows, caption, formatValue = String, valueLabel }: { rows: BarRow[]; caption: string; formatValue?: (n: number) => string; valueLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure>
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const label = row.href ? (
            <Link href={row.href} className="truncate hover:underline">
              {row.label}
            </Link>
          ) : (
            <span className="truncate">{row.label}</span>
          );
          return (
            <li key={row.key} className="group grid grid-cols-[112px_1fr] items-center gap-3 text-[13px]" title={`${row.label}: ${formatValue(row.value)} ${valueLabel}`}>
              {label}
              <div className="flex items-center gap-2">
                <div
                  className={cn("h-2.5 rounded-r-[4px] transition-opacity group-hover:opacity-80")}
                  style={{ width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / max) * 85)}%`, background: SERIES }}
                />
                <span className="tabular text-xs font-medium">{formatValue(row.value)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="sr-only">
        <table>
        <caption>{caption}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{formatValue(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
