'use client';

import React, { useState } from 'react';

/**
 * Minimal, dependency-free charts for the dashboard.
 *
 * Single-series, brand gold (#b98f42). Gold is 2.9:1 against white, so values
 * are never color-only: columns show the peak and latest value, bars show a
 * value at every tip, every mark has a hover tooltip, and each chart carries a
 * screen-reader table with the full data.
 */

const GOLD = '#b98f42';

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * 4 >= value) ?? magnitude * 10;
  return step * 4;
}

export function ColumnChart({
  points,
  formatLabel,
  caption,
}: {
  points: { label: string; count: number }[];
  formatLabel: (label: string) => string;
  caption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...points.map((p) => p.count)));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const peakIndex = points.reduce((best, p, i) => (p.count > points[best].count ? i : best), 0);
  const lastIndex = points.length - 1;
  const every = Math.ceil(points.length / 7); // x-axis label density

  return (
    <figure className="w-full">
      <div className="relative flex h-64 gap-3">
        {/* Y axis ticks */}
        <div className="flex w-8 flex-col-reverse justify-between pb-6 text-right text-[11px] tabular-nums text-gray-400">
          {ticks.map((t) => (
            <span key={t} className="leading-none">{Math.round(t).toLocaleString()}</span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* Hairline grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col-reverse justify-between">
            {ticks.map((t) => (
              <div key={t} className="h-px w-full bg-gray-100" />
            ))}
          </div>

          {/* Columns */}
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-[2px]">
            {points.map((p, i) => {
              const height = max ? (p.count / max) * 100 : 0;
              const showValue = p.count > 0 && (i === peakIndex || i === lastIndex);
              return (
                <div
                  key={p.label}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {showValue && hover !== i && (
                    <span
                      className="absolute text-[11px] font-bold tabular-nums text-gray-700"
                      style={{ bottom: `calc(${height}% + 4px)` }}
                    >
                      {p.count}
                    </span>
                  )}
                  <div
                    className="w-full max-w-[24px] rounded-t-[4px] transition-opacity"
                    style={{
                      height: `${height}%`,
                      minHeight: p.count > 0 ? 2 : 0,
                      background: GOLD,
                      opacity: hover === null || hover === i ? 1 : 0.45,
                    }}
                  />
                  {hover === i && (
                    <div
                      className="pointer-events-none absolute z-10 -translate-y-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
                      style={{ bottom: `${height}%` }}
                    >
                      <p className="text-gray-300">{formatLabel(p.label)}</p>
                      <p className="font-bold">
                        {p.count} lead{p.count === 1 ? '' : 's'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* X axis labels */}
          <div className="absolute inset-x-0 bottom-0 flex h-5 gap-[2px]">
            {points.map((p, i) => (
              <span key={p.label} className="relative flex-1">
                {(i % every === 0 || (i === lastIndex && lastIndex % every >= every / 2)) && (
                  // Centered under its column and allowed to extend past the narrow slot.
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[11px] text-gray-400">
                    {formatLabel(p.label)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr><th>Period</th><th>Leads</th></tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}><td>{formatLabel(p.label)}</td><td>{p.count}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function BarList({
  rows,
  unit,
  caption,
}: {
  rows: { label: string; value: number }[];
  unit: string;
  caption: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="w-full">
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.label} className="group" title={`${row.label}: ${row.value} ${unit}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
              <span className="truncate font-medium text-gray-700">{row.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="h-3 rounded-e-[4px] transition-opacity group-hover:opacity-80"
                style={{ width: `${Math.max(2, (row.value / max) * 88)}%`, background: GOLD }}
              />
              <span className="text-xs font-bold tabular-nums text-gray-700">{row.value}</span>
            </div>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr><th>Area</th><th>{unit}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}><td>{r.label}</td><td>{r.value}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
