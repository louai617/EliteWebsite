'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';
import type { PricePoint } from '@/data/properties';

interface PriceTrendsChartProps {
  history: PricePoint[];
  communityLabel: string;
  cityLabel: string;
  /** Unit shown beside each value, e.g. "QAR/m²" or "QAR/m²/year". */
  axisLabel: string;
}

const RANGES = [
  { key: '3m', months: 2 },
  { key: '6m', months: 4 },
  { key: '1y', months: 0 }, // 0 = everything we have
] as const;

// Chart geometry, in viewBox units. Text scales with the box.
const W = 720;
const H = 260;
const PAD = { top: 20, right: 16, bottom: 34, left: 56 };

export default function PriceTrendsChart({
  history,
  communityLabel,
  cityLabel,
  axisLabel,
}: PriceTrendsChartProps) {
  const t = useTranslations('property');
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('1y');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => {
    const config = RANGES.find((r) => r.key === range);
    if (!config || config.months === 0) return history;
    return history.slice(-config.months - 1);
  }, [history, range]);

  const geometry = useMemo(() => {
    const values = data.flatMap((point) => [point.community, point.city]);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    // Pad the domain so lines never touch the frame.
    const span = rawMax - rawMin || 1;
    const min = rawMin - span * 0.25;
    const max = rawMax + span * 0.2;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (index: number) =>
      PAD.left + (data.length === 1 ? innerW / 2 : (index / (data.length - 1)) * innerW);
    const y = (value: number) => PAD.top + innerH - ((value - min) / (max - min)) * innerH;

    const line = (pick: (point: PricePoint) => number) =>
      data.map((point, index) => `${x(index)},${y(pick(point))}`).join(' ');

    const area =
      `${PAD.left},${PAD.top + innerH} ` +
      line((point) => point.community) +
      ` ${x(data.length - 1)},${PAD.top + innerH}`;

    // Three horizontal guides across the padded domain.
    const gridValues = [0, 0.5, 1].map((ratio) => min + (max - min) * ratio);

    // Rent series sit in the hundreds, so "K" would collapse every tick to "1K".
    const tick = (value: number) =>
      max >= 10_000 ? `${Math.round(value / 1000)}K` : Math.round(value).toLocaleString();

    return { x, y, line, area, gridValues, tick, min, max };
  }, [data]);

  const growth = useMemo(() => {
    if (data.length < 2) return 0;
    const first = data[0].community;
    const last = data[data.length - 1].community;
    return Math.round(((last - first) / first) * 100);
  }, [data]);

  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Map client x into viewBox units, then to the nearest data index.
    const viewX = ((event.clientX - rect.left) / rect.width) * W;
    const innerW = W - PAD.left - PAD.right;
    const ratio = (viewX - PAD.left) / innerW;
    const index = Math.round(ratio * (data.length - 1));
    setHoverIndex(Math.max(0, Math.min(data.length - 1, index)));
  };

  const active = hoverIndex !== null ? data[hoverIndex] : data[data.length - 1];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            {t('trends_growth', { percent: growth > 0 ? `+${growth}` : growth })}
          </span>
        </div>

        <div
          role="tablist"
          aria-label={t('trends_title')}
          className="flex rounded-lg border border-gray-200 p-0.5"
        >
          {RANGES.map((option) => (
            <button
              key={option.key}
              role="tab"
              type="button"
              aria-selected={range === option.key}
              onClick={() => {
                setRange(option.key);
                setHoverIndex(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                range === option.key
                  ? 'bg-secondary text-white'
                  : 'text-gray-500 hover:text-secondary'
              }`}
            >
              {t(`trends_range_${option.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Time flows left-to-right in both locales, so the plot stays LTR. */}
      <div dir="ltr" className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[520px] touch-none"
          role="img"
          aria-label={`${communityLabel}: ${t('trends_growth', {
            percent: growth > 0 ? `+${growth}` : growth,
          })}`}
          onPointerMove={handlePointer}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="communityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b98f42" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#b98f42" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal guides + value labels */}
          {geometry.gridValues.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={geometry.y(value)}
                y2={geometry.y(value)}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text
                x={PAD.left - 10}
                y={geometry.y(value) + 4}
                textAnchor="end"
                className="fill-gray-400"
                style={{ fontSize: '11px' }}
              >
                {geometry.tick(value)}
              </text>
            </g>
          ))}

          <polygon points={geometry.area} fill="url(#communityFill)" />

          <polyline
            points={geometry.line((point) => point.city)}
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
          <polyline
            points={geometry.line((point) => point.community)}
            fill="none"
            stroke="#b98f42"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X labels */}
          {data.map((point, index) => (
            <text
              key={point.label}
              x={geometry.x(index)}
              y={H - 12}
              textAnchor="middle"
              className="fill-gray-400"
              style={{ fontSize: '11px' }}
            >
              {point.label}
            </text>
          ))}

          {/* Hover readout */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={geometry.x(hoverIndex)}
                x2={geometry.x(hoverIndex)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="#1a1a1a"
                strokeWidth="1"
                strokeOpacity="0.25"
              />
              <circle
                cx={geometry.x(hoverIndex)}
                cy={geometry.y(data[hoverIndex].city)}
                r="4"
                fill="#fff"
                stroke="#9ca3af"
                strokeWidth="2"
              />
              <circle
                cx={geometry.x(hoverIndex)}
                cy={geometry.y(data[hoverIndex].community)}
                r="5"
                fill="#fff"
                stroke="#b98f42"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Legend doubles as the hover readout so values are always visible. */}
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        <div className="flex items-center gap-2.5">
          <span className="h-0.5 w-6 rounded-full bg-primary" aria-hidden="true" />
          <div>
            <p className="text-xs text-gray-500">{communityLabel}</p>
            <p className="text-sm font-bold tabular-nums text-secondary">
              {active.community.toLocaleString()}{' '}
              <span className="text-xs font-medium text-gray-400">{axisLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="h-0.5 w-6 rounded-full bg-gray-400"
            style={{ backgroundImage: 'repeating-linear-gradient(90deg,#9ca3af 0 5px,transparent 5px 9px)' }}
            aria-hidden="true"
          />
          <div>
            <p className="text-xs text-gray-500">{cityLabel}</p>
            <p className="text-sm font-bold tabular-nums text-secondary">
              {active.city.toLocaleString()}{' '}
              <span className="text-xs font-medium text-gray-400">{axisLabel}</span>
            </p>
          </div>
        </div>
        <p className="ms-auto self-end text-xs text-gray-400">{active.label}</p>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-gray-400">{t('trends_note')}</p>
    </div>
  );
}
