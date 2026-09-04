'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

interface ExpandableTextProps {
  text: string;
  /** Paragraphs shown before the fold. */
  previewParagraphs?: number;
}

/**
 * Description block that collapses to the first paragraphs behind a soft fade.
 * Collapsed content stays in the DOM so it remains searchable and indexable.
 */
export default function ExpandableText({ text, previewParagraphs = 2 }: ExpandableTextProps) {
  const t = useTranslations('property');
  const [expanded, setExpanded] = useState(false);

  const paragraphs = text.split('\n\n').filter(Boolean);
  const needsToggle = paragraphs.length > previewParagraphs;

  return (
    <div>
      <div className="relative">
        <div
          className={`space-y-4 text-[15px] leading-relaxed text-gray-600 transition-all ${
            !expanded && needsToggle ? 'max-h-56 overflow-hidden' : ''
          }`}
        >
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {!expanded && needsToggle && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent"
          />
        )}
      </div>

      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {expanded ? t('read_less') : t('read_more')}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}
