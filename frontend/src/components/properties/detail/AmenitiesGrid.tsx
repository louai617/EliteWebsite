'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Wind, Car, Waves, ShieldCheck, ConciergeBell, Dumbbell, Shirt, BedDouble,
  Eye, ChefHat, PawPrint, Umbrella, BookOpen, Flame, ArrowUpDown, Clapperboard,
  Trees, Sun, Check, ChevronDown,
} from 'lucide-react';

/** Amenity key → icon. Anything unmapped falls back to a check mark. */
const AMENITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  balcony: Sun,
  built_in_wardrobes: Shirt,
  central_ac: Wind,
  covered_parking: Car,
  shared_pool: Waves,
  private_pool: Waves,
  private_garden: Trees,
  security: ShieldCheck,
  concierge: ConciergeBell,
  shared_gym: Dumbbell,
  walk_in_closet: Shirt,
  maid_room: BedDouble,
  sea_view: Eye,
  kitchen_appliances: ChefHat,
  pets_allowed: PawPrint,
  beach_access: Umbrella,
  study: BookOpen,
  barbecue_area: Flame,
  private_lift: ArrowUpDown,
  cinema_room: Clapperboard,
};

interface AmenitiesGridProps {
  amenities: string[];
  /** How many to show before the "see all" toggle. */
  previewCount?: number;
}

export default function AmenitiesGrid({ amenities, previewCount = 10 }: AmenitiesGridProps) {
  const t = useTranslations('property');
  const [expanded, setExpanded] = useState(false);

  const needsToggle = amenities.length > previewCount;
  const visible = expanded ? amenities : amenities.slice(0, previewCount);

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((amenity) => {
          const Icon = AMENITY_ICONS[amenity] ?? Check;
          return (
            <li
              key={amenity}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-3 text-sm text-gray-700"
            >
              <Icon className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
              <span className="truncate">{t(`amenity_${amenity}`)}</span>
            </li>
          );
        })}
      </ul>

      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {expanded
            ? t('show_fewer_amenities')
            : t('see_all_amenities', { count: amenities.length })}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}
