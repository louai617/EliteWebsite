'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Bed, Bath, Maximize, MapPin, ShieldCheck } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Property } from '@/data/properties';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PropertyCardProps {
  property: Property;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const t = useTranslations('common');
  const tProperty = useTranslations('property');
  const locale = useLocale();
  const isRtl = locale === 'ar';

  const title = isRtl ? property.title_ar : property.title_en;
  const area = isRtl ? property.location.area_ar : property.location.area_en;
  const city = isRtl ? property.location.city_ar : property.location.city_en;

  const frequencySuffix = property.price_frequency
    ? tProperty(property.price_frequency === 'month' ? 'per_month' : 'per_year')
    : '';

  return (
    <Link
      href={`/${locale}/properties/${property._id}`}
      className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow duration-300 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="relative h-56 w-full overflow-hidden">
        <Image
          src={property.images[0]}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute start-4 top-4 flex flex-col items-start gap-2">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider',
              property.purpose === 'sale' ? 'bg-secondary text-white' : 'bg-primary text-white'
            )}
          >
            {property.purpose === 'sale' ? tProperty('for_sale') : tProperty('for_rent')}
          </span>
          {property.is_verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-sm backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {tProperty('verified')}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <p className="mb-2 flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
          <span className="truncate">
            {area}, {city}
          </span>
        </p>

        <h3 className="mb-3 line-clamp-1 text-lg font-bold text-secondary transition-colors group-hover:text-primary">
          {title}
        </h3>

        <div className="mb-4 flex items-baseline justify-between gap-2">
          <p className="text-xl font-bold text-secondary">
            {property.price.toLocaleString()}
            <span className="ms-1.5 text-sm font-semibold text-primary">{property.currency}</span>
            {frequencySuffix && (
              <span className="text-sm font-medium text-gray-400">{frequencySuffix}</span>
            )}
          </p>
          <p className="flex-none text-xs text-gray-400">{property.reference_number}</p>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-gray-600">
          <span className="flex items-center gap-1.5">
            <Bed className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <span className="text-sm font-medium">{property.bedrooms}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Bath className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <span className="text-sm font-medium">{property.bathrooms}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Maximize className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <span className="text-sm font-medium">
              {property.area_sqm} {t('sqm')}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
};

export default PropertyCard;
