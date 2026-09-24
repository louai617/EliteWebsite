'use client';

import React, { useCallback, useState } from 'react';
import { apiErrorMessage, apiFieldErrors } from '@/lib/api';
import { Field, inputClass } from './ui';

/**
 * Tiny form-state helper for the CRM modals. Values are validated on the
 * server (zod); field errors from a 400 response are mapped back onto inputs.
 */

export type FormValues = Record<string, unknown>;

export function useCrmForm<T extends FormValues>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  const reset = useCallback((next: T) => {
    setValues(next);
    setErrors({});
    setFormError(null);
  }, []);

  /** Run a save; on failure, show the message and per-field errors. Returns true on success. */
  const submit = useCallback(async (action: () => Promise<unknown>) => {
    setSaving(true);
    setFormError(null);
    setErrors({});
    try {
      await action();
      return true;
    } catch (error) {
      setFormError(apiErrorMessage(error));
      const fields = apiFieldErrors(error);
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { values, set, errors, formError, setFormError, saving, reset, submit };
}

type Setter = (key: string, value: unknown) => void;

interface BaseProps {
  name: string;
  label: string;
  values: FormValues;
  set: Setter;
  errors: Record<string, string>;
  className?: string;
  hint?: string;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function TextInput({ name, label, values, set, errors, className, hint, type = 'text', placeholder, required }: BaseProps & {
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Field label={required ? `${label} *` : label} error={errors[name]} className={className} hint={hint}>
      <input
        type={type}
        className={inputClass}
        value={str(values[name])}
        placeholder={placeholder}
        onChange={(e) => set(name, e.target.value)}
      />
    </Field>
  );
}

export function NumberInput({ name, label, values, set, errors, className, hint, min = 0, step, required }: BaseProps & {
  min?: number;
  step?: number | 'any';
  required?: boolean;
}) {
  return (
    <Field label={required ? `${label} *` : label} error={errors[name]} className={className} hint={hint}>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step ?? 'any'}
        className={inputClass}
        value={str(values[name])}
        onChange={(e) => set(name, e.target.value === '' ? '' : e.target.value)}
      />
    </Field>
  );
}

export function SelectInput({ name, label, values, set, errors, className, hint, options, emptyLabel, required }: BaseProps & {
  options: { value: string; label: string }[];
  emptyLabel?: string;
  required?: boolean;
}) {
  return (
    <Field label={required ? `${label} *` : label} error={errors[name]} className={className} hint={hint}>
      <select className={inputClass} value={str(values[name])} onChange={(e) => set(name, e.target.value)}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function TextArea({ name, label, values, set, errors, className, hint, rows = 3 }: BaseProps & { rows?: number }) {
  return (
    <Field label={label} error={errors[name]} className={className} hint={hint}>
      <textarea
        rows={rows}
        className={`${inputClass} resize-y leading-relaxed`}
        value={str(values[name])}
        onChange={(e) => set(name, e.target.value)}
      />
    </Field>
  );
}

export function CheckboxGroup({ name, label, values, set, errors, className, options }: BaseProps & {
  options: { value: string; label: string }[];
}) {
  const selected = (values[name] as string[] | undefined) ?? [];
  return (
    <Field label={label} error={errors[name]} className={className}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => set(name, on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                on ? 'border-[#b98f42] bg-[#b98f42] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b98f42]'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

/** Turn form strings into API values: '' → null (clears on update), numeric strings stay strings (server coerces). */
export function cleanPayload(values: FormValues, keys?: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (keys && !keys.includes(key)) continue;
    out[key] = value === '' ? null : value;
  }
  return out;
}

/** Local datetime-input value → ISO string (or null). */
export function toIso(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
