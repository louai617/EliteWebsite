"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPropertyAction, updatePropertyAction } from "@/actions/properties";
import { useFormAction } from "@/hooks/use-action";
import {
  AMENITIES,
  FURNISHING_META,
  PROPERTY_CATEGORY_META,
  PROPERTY_STATUS_META,
  PROPERTY_SUBCATEGORY_META,
  PROPERTY_TYPE_META,
  PROPERTY_TYPES_BY_CATEGORY,
  PURPOSE_META,
  QATAR_AREAS,
  options,
} from "@/lib/constants";
import { propertySchema, type PropertyInput, type PropertyValues } from "@/schemas/property";
import type { AgentOption, Viewer } from "@/types/options";
import type { LookupOption } from "@/types/search";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { AgentField } from "@/components/shared/form/agent-field";
import { CheckboxField, EntityField, FormSection, SelectField, TextField, TextareaField } from "@/components/shared/form/fields";

export type PropertyFormDefaults = Partial<Record<keyof PropertyInput, unknown>>;

const EMPTY: PropertyInput = {
  title: "",
  category: "RESIDENTIAL",
  subcategory: "PRIVATE",
  type: "APARTMENT",
  purpose: "RENT",
  status: "AVAILABLE",
  price: "",
  currency: "QAR",
  areaSqm: "",
  bedrooms: "",
  bathrooms: "",
  floor: "",
  buildingNumber: "",
  tower: "",
  yearBuilt: "",
  country: "Qatar",
  city: "Doha",
  area: "",
  street: "",
  buildingName: "",
  googleMapsUrl: "",
  latitude: "",
  longitude: "",
  furnishing: null,
  description: "",
  parkingSpaces: 0,
  hasBalcony: false,
  hasMaidRoom: false,
  hasPool: false,
  hasGym: false,
  hasSeaView: false,
  hasMarinaView: false,
  hasGarden: false,
  hasBbq: false,
  hasSecurity: false,
  hasCentralAc: false,
  hasInternet: false,
  billsIncluded: false,
  propertyFinderUrl: "",
  externalUrl: "",
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
  ownerId: null,
  agentId: null,
};

/** Replaces nulls with "" so inputs stay controlled. */
function toFormValues(values: PropertyFormDefaults): PropertyInput {
  const merged = { ...EMPTY } as Record<string, unknown>;
  for (const [key, value] of Object.entries(values)) {
    if (!(key in EMPTY)) continue;
    const isSelect = key === "furnishing" || key === "ownerId" || key === "agentId";
    merged[key] = value === null || value === undefined ? (isSelect ? null : (EMPTY as Record<string, unknown>)[key]) : value;
  }
  return merged as PropertyInput;
}

export function PropertyForm({
  propertyId,
  defaults,
  ownerOption,
  agents,
  viewer,
  areas,
}: {
  propertyId?: string;
  defaults?: PropertyFormDefaults;
  ownerOption?: LookupOption | null;
  agents: AgentOption[];
  viewer: Viewer;
  areas: string[];
}) {
  const router = useRouter();
  const form = useForm<PropertyInput, unknown, PropertyValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: toFormValues({ ...(viewer.isManager ? {} : { agentId: viewer.id }), ...defaults }),
    mode: "onTouched",
  });
  const purpose = useWatch({ control: form.control, name: "purpose" });
  const category = (useWatch({ control: form.control, name: "category" }) as keyof typeof PROPERTY_TYPES_BY_CATEGORY | undefined) ?? "RESIDENTIAL";
  const allowedTypes = PROPERTY_TYPES_BY_CATEGORY[category];
  const typeOptions = options(PROPERTY_TYPE_META).filter((o) => allowedTypes.includes(o.value));

  // Keep the type consistent with the category (e.g. switching to Commercial drops "Villa").
  useEffect(() => {
    const current = form.getValues("type");
    if (!allowedTypes.includes(current)) form.setValue("type", allowedTypes[0], { shouldDirty: true });
  }, [allowedTypes, form]);
  const areaOptions = Array.from(new Set([...QATAR_AREAS, ...areas])).sort();

  const onSubmit = useFormAction(
    form,
    (values: PropertyValues) => (propertyId ? updatePropertyAction({ ...values, id: propertyId }) : createPropertyAction(values)),
    {
      onSuccess: (data) => {
        const id = (data as { id: string }).id;
        router.push(`/properties/${id}`);
      },
    },
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <div className="space-y-6 rounded-lg border bg-card p-5 sm:p-6">
          <FormSection title="Listing" description="What it is and how it is offered.">
            <TextField control={form.control} name="title" label="Title" required placeholder="Sea-view 2BR apartment in Porto Arabia" className="sm:col-span-2" />
            <SelectField control={form.control} name="category" label="Category" required options={options(PROPERTY_CATEGORY_META)} />
            <SelectField control={form.control} name="subcategory" label="Listed by" required options={options(PROPERTY_SUBCATEGORY_META)} description="Company-owned or a private owner" />
            <SelectField control={form.control} name="type" label="Property type" required options={typeOptions} />
            <SelectField control={form.control} name="purpose" label="Purpose" required options={options(PURPOSE_META)} />
            <SelectField control={form.control} name="status" label="Status" required options={options(PROPERTY_STATUS_META)} />
            <div className="grid grid-cols-[1fr_88px] gap-2">
              <TextField
                control={form.control}
                name="price"
                label={purpose === "RENT" ? "Monthly rent" : "Sale price"}
                required
                inputMode="numeric"
                placeholder={purpose === "RENT" ? "12000" : "1850000"}
              />
              <TextField control={form.control} name="currency" label="Currency" maxLength={3} />
            </div>
          </FormSection>

          <FormSection title="Specifications">
            <TextField control={form.control} name="areaSqm" label="Size (sqm)" inputMode="decimal" />
            <TextField control={form.control} name="bedrooms" label="Bedrooms" inputMode="numeric" description="0 for studio" />
            <TextField control={form.control} name="bathrooms" label="Bathrooms" inputMode="numeric" />
            <TextField control={form.control} name="parkingSpaces" label="Parking spaces" inputMode="numeric" />
            <TextField control={form.control} name="floor" label="Floor" inputMode="numeric" />
            <TextField control={form.control} name="yearBuilt" label="Year built" inputMode="numeric" />
            <TextField control={form.control} name="tower" label="Tower" />
            <TextField control={form.control} name="buildingNumber" label="Building no." />
            <SelectField control={form.control} name="furnishing" label="Furnishing" options={options(FURNISHING_META)} allowEmpty emptyLabel="Not specified" />
          </FormSection>

          <FormSection title="Location" description="Area is used for filtering and matching leads.">
            <SelectField control={form.control} name="area" label="Area" required options={areaOptions.map((a) => ({ value: a, label: a }))} placeholder="Choose an area" />
            <TextField control={form.control} name="buildingName" label="Building / project" placeholder="Porto Arabia Tower 12" />
            <TextField control={form.control} name="street" label="Street" />
            <TextField control={form.control} name="city" label="City" required />
            <TextField control={form.control} name="country" label="Country" required />
            <TextField control={form.control} name="googleMapsUrl" label="Google Maps URL" type="url" placeholder="https://maps.google.com/…" />
            <TextField control={form.control} name="latitude" label="Latitude" inputMode="decimal" />
            <TextField control={form.control} name="longitude" label="Longitude" inputMode="decimal" />
          </FormSection>

          <FormSection title="Amenities">
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 md:grid-cols-3">
              {AMENITIES.map((a) => (
                <CheckboxField key={a.key} control={form.control} name={a.key} label={a.label} />
              ))}
            </div>
          </FormSection>

          <FormSection title="Description">
            <TextareaField control={form.control} name="description" label="Description" className="sm:col-span-2" rows={6} placeholder="Highlights, views, community facilities, availability…" />
          </FormSection>

          <FormSection title="Ownership & team">
            <EntityField control={form.control} name="ownerId" label="Owner" kind="owner" placeholder="Search owners…" initialOption={ownerOption} description="Add new owners from the Owners page." />
            <AgentField control={form.control} name="agentId" agents={agents} viewer={viewer} />
          </FormSection>

          <FormSection title="Marketing" description="Portal links and SEO for the public website.">
            <TextField control={form.control} name="propertyFinderUrl" label="Property Finder URL" type="url" className="sm:col-span-2" />
            <TextField control={form.control} name="externalUrl" label="Other listing URL" type="url" className="sm:col-span-2" />
            <TextField control={form.control} name="seoTitle" label="SEO title" className="sm:col-span-2" />
            <TextareaField control={form.control} name="seoDescription" label="SEO description" className="sm:col-span-2" rows={2} />
            <CheckboxField control={form.control} name="isFeatured" label="Featured listing" />
          </FormSection>
        </div>

        <div className="sticky bottom-0 -mx-3 flex justify-end gap-2 border-t bg-background/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-7 lg:px-7">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={form.formState.isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {propertyId ? "Save changes" : "Create property"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
