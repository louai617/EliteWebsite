"use client";

/**
 * Thin, typed wrappers around shadcn form primitives so feature forms stay short and
 * every field renders label, control, description and inline error the same way.
 */
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EntityCombobox, type LookupKind } from "./entity-combobox";
import type { LookupOption } from "@/types/search";

interface BaseProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: string;
  description?: React.ReactNode;
  required?: boolean;
  className?: string;
}

export function TextField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  description,
  required,
  className,
  ...input
}: BaseProps<T, TOut> & Omit<React.ComponentProps<typeof Input>, "name">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel required={required}>{label}</FormLabel>
          <FormControl>
            <Input {...input} {...field} value={(field.value as string | number | null | undefined) ?? ""} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  description,
  required,
  className,
  ...input
}: BaseProps<T, TOut> & Omit<React.ComponentProps<typeof Textarea>, "name">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel required={required}>{label}</FormLabel>
          <FormControl>
            <Textarea {...input} {...field} value={(field.value as string | null | undefined) ?? ""} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const NONE = "__none__";

export function SelectField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  description,
  required,
  className,
  options,
  placeholder = "Select…",
  allowEmpty = false,
  emptyLabel = "None",
}: BaseProps<T, TOut> & { options: { value: string; label: string }[]; placeholder?: string; allowEmpty?: boolean; emptyLabel?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel required={required}>{label}</FormLabel>
          <Select value={(field.value as string | null | undefined) || (allowEmpty ? NONE : "")} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
            <FormControl>
              <SelectTrigger onBlur={field.onBlur}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {allowEmpty && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function EntityField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  description,
  required,
  className,
  kind,
  placeholder,
  initialOption,
  disabled,
  onSelected,
}: BaseProps<T, TOut> & { kind: LookupKind; placeholder?: string; initialOption?: LookupOption | null; disabled?: boolean; onSelected?: (option: LookupOption | null) => void }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel required={required}>{label}</FormLabel>
          <EntityCombobox
            kind={kind}
            value={field.value as string | null}
            onChange={(v, option) => {
              field.onChange(v);
              onSelected?.(option);
            }}
            placeholder={placeholder}
            initialOption={initialOption}
            disabled={disabled}
            invalid={!!fieldState.error}
            clearable={!required}
          />
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CheckboxField<T extends FieldValues, TOut = T>({ control, name, label, className }: Omit<BaseProps<T, TOut>, "required" | "description">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex flex-row items-center gap-2 space-y-0", className)}>
          <FormControl>
            <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(v === true)} />
          </FormControl>
          <FormLabel className="cursor-pointer font-normal">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-4 border-b pb-6 last:border-0 last:pb-0 md:grid-cols-[220px_1fr] md:gap-8", className)}>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
