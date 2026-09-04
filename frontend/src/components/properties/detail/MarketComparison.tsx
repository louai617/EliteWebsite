import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MarketComparisonProps {
  label: string;
  /** This listing's value. */
  value: number;
  /** The community average to compare against. */
  average: number;
  /** Percentage difference, positive when above average. */
  delta: number;
  /** Rendered after each number, e.g. "QAR" or "m²". */
  unit: string;
  thisLabel: string;
  averageLabel: string;
}

/**
 * Two proportional bars comparing this listing against its community average.
 * Bars are scaled to the larger of the two so the difference is readable at a
 * glance rather than stated only in prose.
 */
export default function MarketComparison({
  label,
  value,
  average,
  delta,
  unit,
  thisLabel,
  averageLabel,
}: MarketComparisonProps) {
  const peak = Math.max(value, average) || 1;

  const tone =
    delta > 0
      ? { text: 'text-amber-700', bg: 'bg-amber-50', Icon: ArrowUpRight }
      : delta < 0
        ? { text: 'text-emerald-700', bg: 'bg-emerald-50', Icon: ArrowDownRight }
        : { text: 'text-gray-600', bg: 'bg-gray-50', Icon: Minus };

  return (
    <div className="rounded-2xl border border-gray-100 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-secondary">{label}</p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${tone.bg} ${tone.text}`}
        >
          <tone.Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {delta > 0 ? '+' : ''}
          {delta}%
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-medium text-secondary">{thisLabel}</span>
            <span className="font-bold tabular-nums text-secondary">
              {value.toLocaleString()} <span className="font-medium text-gray-400">{unit}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(value / peak) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="text-gray-500">{averageLabel}</span>
            <span className="font-semibold tabular-nums text-gray-500">
              {average.toLocaleString()} <span className="font-medium text-gray-400">{unit}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gray-300"
              style={{ width: `${(average / peak) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
