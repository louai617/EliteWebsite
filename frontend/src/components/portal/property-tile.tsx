'use client';

import React from 'react';
import { Bath, BedDouble, MapPin, Maximize } from 'lucide-react';
import type { PortalProperty } from '@/lib/api-types';
import { Badge, label, money } from './ui';

/** Listing summary for the portal. Plain <img>: photos are served by the API with the session cookie. */
export function PropertyTile({ property, footer }: { property: PortalProperty; footer?: React.ReactNode }) {
  const cover = property.images.find((i) => i.isPrimary) ?? property.images[0];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="aspect-[16/10] bg-gray-100 relative">
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">No photo</div>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={property.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Unreachable photo: fall back to the placeholder underneath.
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge tone="gold">{property.purpose === 'RENT' ? 'For rent' : 'For sale'}</Badge>
          <Badge>{label(property.category)}</Badge>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <p className="text-xs text-gray-400 font-mono">{property.reference}</p>
        <h3 className="font-bold text-gray-900 mt-1 line-clamp-2">{property.title}</h3>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> {[property.buildingName, property.area, property.city].filter(Boolean).join(', ')}
        </p>
        <p className="text-lg font-bold text-[#b98f42] mt-2">
          {money(property.price, property.currency)}
          {property.purpose === 'RENT' && <span className="text-sm text-gray-400 font-medium"> / month</span>}
        </p>
        <div className="flex gap-4 text-xs text-gray-500 mt-2">
          {property.bedrooms != null && (
            <span className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5" /> {property.bedrooms === 0 ? 'Studio' : `${property.bedrooms} bed`}
            </span>
          )}
          {property.bathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" /> {property.bathrooms} bath
            </span>
          )}
          {property.areaSqm != null && (
            <span className="flex items-center gap-1">
              <Maximize className="w-3.5 h-3.5" /> {property.areaSqm} m²
            </span>
          )}
        </div>
        {footer && <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">{footer}</div>}
      </div>
    </div>
  );
}
