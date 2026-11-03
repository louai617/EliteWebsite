"use client";

import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { COMPLETION_META, EXTRA_AMENITIES, HIGHLIGHTS, NEARBY_CATEGORIES, OWNERSHIP_META, PAYMENT_MILESTONES, options } from "@/lib/constants";
import type { NearbyPlace, PaymentMilestone, PropertyInput, PropertyValues } from "@/schemas/property";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CheckboxField, FormSection, SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

type Ctl = Control<PropertyInput, unknown, PropertyValues>;

const selectCls = "h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

/** Checkbox grid bound to a string[] field. */
function MultiCheck({ control, name, label, items, description }: { control: Ctl; name: "amenities" | "highlights"; label: string; items: readonly { value: string; label: string }[]; description?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value = (Array.isArray(field.value) ? field.value : []) as string[];
        const toggle = (key: string, on: boolean) => field.onChange(on ? [...value, key] : value.filter((v) => v !== key));
        return (
          <FormItem className="sm:col-span-2">
            <FormLabel>{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
            <div className="grid grid-cols-2 gap-2.5 pt-1 md:grid-cols-3">
              {items.map((item) => (
                <label key={item.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={value.includes(item.value)} onCheckedChange={(v) => toggle(item.value, v === true)} />
                  {item.label}
                </label>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function NearbyEditor({ control }: { control: Ctl }) {
  return (
    <FormField
      control={control}
      name="nearby"
      render={({ field }) => {
        const rows = (Array.isArray(field.value) ? field.value : []) as NearbyPlace[];
        const update = (i: number, patch: Partial<NearbyPlace>) => field.onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
        return (
          <FormItem className="sm:col-span-2">
            <FormLabel>Nearby places</FormLabel>
            <FormDescription>Schools, malls, metro, beaches… shown in the website&apos;s Location section.</FormDescription>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-2 md:grid-cols-[120px_1fr_1fr_80px_96px_auto]">
                  <select aria-label="Category" className={selectCls} value={row.category} onChange={(e) => update(i, { category: e.target.value as NearbyPlace["category"] })}>
                    {NEARBY_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <Input aria-label="Name (English)" placeholder="Name (English)" value={row.nameEn} maxLength={120} onChange={(e) => update(i, { nameEn: e.target.value })} />
                  <Input aria-label="Name (Arabic)" placeholder="الاسم (عربي)" dir="rtl" value={row.nameAr ?? ""} maxLength={120} onChange={(e) => update(i, { nameAr: e.target.value })} />
                  <Input aria-label="Minutes" inputMode="numeric" placeholder="Min" value={String(row.minutes ?? "")} onChange={(e) => update(i, { minutes: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                  <select aria-label="Mode" className={selectCls} value={row.mode} onChange={(e) => update(i, { mode: e.target.value as NearbyPlace["mode"] })}>
                    <option value="drive">Drive</option>
                    <option value="walk">Walk</option>
                  </select>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove place" onClick={() => field.onChange(rows.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {rows.length < 12 && (
                <Button type="button" variant="outline" size="sm" onClick={() => field.onChange([...rows, { category: "school", nameEn: "", nameAr: "", minutes: 5, mode: "drive" }])}>
                  <Plus /> Add place
                </Button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function PaymentPlanEditor({ control }: { control: Ctl }) {
  return (
    <FormField
      control={control}
      name="paymentPlan"
      render={({ field }) => {
        const rows = (Array.isArray(field.value) ? field.value : []) as PaymentMilestone[];
        const total = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
        const update = (i: number, patch: Partial<PaymentMilestone>) => field.onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
        return (
          <FormItem className="sm:col-span-2">
            <FormLabel>Payment plan</FormLabel>
            <FormDescription>
              Off-plan instalments, must total 100%.{rows.length > 0 && <span className={cn("ms-1 font-medium", Math.abs(total - 100) > 0.01 && "text-destructive")}>Now {total}%.</span>}
            </FormDescription>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-2 md:grid-cols-[160px_80px_1fr_1fr_auto]">
                  <select aria-label="Milestone" className={selectCls} value={row.key} onChange={(e) => update(i, { key: e.target.value as PaymentMilestone["key"] })}>
                    {PAYMENT_MILESTONES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <Input aria-label="Percent" inputMode="decimal" placeholder="%" value={String(row.percent ?? "")} onChange={(e) => update(i, { percent: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} />
                  <Input aria-label="Timing (English)" placeholder="On booking / Over 36 months" value={row.timingEn} maxLength={80} onChange={(e) => update(i, { timingEn: e.target.value })} />
                  <Input aria-label="Timing (Arabic)" placeholder="التوقيت (عربي)" dir="rtl" value={row.timingAr ?? ""} maxLength={80} onChange={(e) => update(i, { timingAr: e.target.value })} />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove milestone" onClick={() => field.onChange(rows.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {rows.length < 8 && (
                <Button type="button" variant="outline" size="sm" onClick={() => field.onChange([...rows, { key: rows.length ? "construction" : "booking", percent: 10, timingEn: "", timingAr: "" }])}>
                  <Plus /> Add milestone
                </Button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * What the public website (eliterealestate.qa) shows. Everything here is optional except the
 * publish switch; empty fields simply hide the matching section on the website.
 */
export function WebsiteSection({ control }: { control: Ctl }) {
  const completion = useWatch({ control, name: "completionStatus" });
  const purpose = useWatch({ control, name: "purpose" });
  return (
    <>
      <FormSection title="Website" description="How the listing appears on eliterealestate.qa. Changes go live within seconds.">
        <FormField
          control={control}
          name="websitePublished"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border bg-muted/40 p-3 sm:col-span-2">
              <FormControl>
                <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
              </FormControl>
              <div>
                <FormLabel className="cursor-pointer">Show on the website</FormLabel>
                <FormDescription>Visible while Available or Reserved. Publishing counts as a posting for the assigned agent.</FormDescription>
              </div>
            </FormItem>
          )}
        />
        <CheckboxField control={control} name="isExclusive" label="Exclusive listing" />
        <CheckboxField control={control} name="isVerified" label="Verified (documents checked)" />
        <TextField control={control} name="titleAr" label="Title (Arabic)" dir="rtl" className="sm:col-span-2" placeholder="شقة فاخرة بإطلالة بحرية" />
        <TextareaField control={control} name="descriptionAr" label="Description (Arabic)" dir="rtl" rows={5} className="sm:col-span-2" />
        <SelectField control={control} name="completionStatus" label="Completion" options={options(COMPLETION_META)} />
        <SelectField control={control} name="ownershipType" label="Ownership" options={options(OWNERSHIP_META)} allowEmpty emptyLabel="Not specified" />
        <TextField control={control} name="availableFrom" label="Available from" type="date" />
        {completion === "OFF_PLAN" && <TextField control={control} name="handover" label="Handover" placeholder="Q4 2027" />}
        <TextField control={control} name="developer" label="Developer" />
        <TextField control={control} name="totalFloors" label="Floors in building" inputMode="numeric" />
        <TextField control={control} name="plotSqm" label="Plot size (sqm)" inputMode="decimal" />
        <TextField control={control} name="serviceChargeSqm" label="Service charge (QAR/sqm/yr)" inputMode="decimal" />
        <MultiCheck control={control} name="highlights" label="Highlights" items={HIGHLIGHTS} description="Up to 10 badges shown above the description." />
        <MultiCheck control={control} name="amenities" label="More amenities" items={EXTRA_AMENITIES} description="In addition to the amenity checkboxes above." />
        <NearbyEditor control={control} />
        {(completion === "OFF_PLAN" || purpose === "SALE") && <PaymentPlanEditor control={control} />}
      </FormSection>
    </>
  );
}
