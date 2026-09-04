'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Section {
  id: string;
  /** Key under the `property` namespace */
  labelKey: string;
}

interface PropertyNavProps {
  sections: Section[];
}

/**
 * Sticky in-page nav with scroll spy.
 *
 * Uses IntersectionObserver with a top-weighted root margin so a section counts
 * as "current" once it reaches the band just under the sticky header, rather
 * than when it merely enters the viewport.
 */
export default function PropertyNav({ sections }: PropertyNavProps) {
  const t = useTranslations('property');
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Prefer the entry closest to the top of the reading band.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-120px 0px -65% 0px', threshold: 0 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label={t('nav_overview')}
      className="sticky top-16 z-30 -mx-4 mb-8 border-y border-gray-200/80 bg-white/85 px-4 backdrop-blur-md md:top-20"
    >
      <ul className="flex gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => (
          <li key={section.id} className="flex-none">
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? 'true' : undefined}
              className={`relative block whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active === section.id
                  ? 'text-primary'
                  : 'text-gray-500 hover:text-secondary'
              }`}
            >
              {t(section.labelKey)}
              <span
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary transition-opacity ${
                  active === section.id ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
