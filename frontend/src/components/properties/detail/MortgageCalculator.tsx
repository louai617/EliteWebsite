'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

interface MortgageCalculatorProps {
  price: number;
  currency: string;
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-sm text-gray-600">{label}</label>
        <span className="text-sm font-bold tabular-nums text-secondary">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow
          [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary"
        style={{
          background: `linear-gradient(to right, #b98f42 ${percent}%, #e5e7eb ${percent}%)`,
        }}
      />
    </div>
  );
}

/**
 * Standard amortising repayment estimate.
 * Falls back to simple division when the rate is zero, which the formula can't handle.
 */
export default function MortgageCalculator({ price, currency }: MortgageCalculatorProps) {
  const t = useTranslations('property');

  const [downPercent, setDownPercent] = useState(25);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(5.25);

  const { loanAmount, monthly, totalInterest } = useMemo(() => {
    const loan = price * (1 - downPercent / 100);
    const months = years * 12;
    const monthlyRate = rate / 100 / 12;

    const payment =
      monthlyRate === 0
        ? loan / months
        : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

    return {
      loanAmount: loan,
      monthly: payment,
      totalInterest: payment * months - loan,
    };
  }, [price, downPercent, years, rate]);

  const money = (value: number) => Math.round(value).toLocaleString();

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6">
      <h3 className="text-lg font-bold text-secondary">{t('mortgage_title')}</h3>
      <p className="mb-6 mt-1 text-sm text-gray-500">{t('mortgage_subtitle')}</p>

      <div className="space-y-5">
        <Slider
          label={t('down_payment')}
          value={downPercent}
          display={`${downPercent}% · ${money((price * downPercent) / 100)}`}
          min={5}
          max={80}
          step={5}
          onChange={setDownPercent}
        />
        <Slider
          label={t('loan_term')}
          value={years}
          display={`${years} ${t('years_short')}`}
          min={5}
          max={30}
          step={1}
          onChange={setYears}
        />
        <Slider
          label={t('interest_rate')}
          value={rate}
          display={`${rate.toFixed(2)}%`}
          min={2}
          max={10}
          step={0.25}
          onChange={setRate}
        />
      </div>

      <div className="mt-6 rounded-xl bg-secondary p-5 text-white">
        <p className="text-xs uppercase tracking-wider text-white/60">{t('monthly_payment')}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {money(monthly)}{' '}
          <span className="text-base font-medium text-primary">{currency}</span>
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-sm">
          <div>
            <dt className="text-white/60">{t('loan_amount')}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{money(loanAmount)}</dd>
          </div>
          <div>
            <dt className="text-white/60">{t('total_interest')}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{money(totalInterest)}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-gray-400">{t('mortgage_note')}</p>
    </div>
  );
}
