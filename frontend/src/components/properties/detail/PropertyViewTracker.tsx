'use client';

import { useEffect } from 'react';

/**
 * Counts one view per listing per browser session. Done from the browser (not
 * during server rendering) so cached pages, bots and link prefetches don't
 * inflate the numbers agents see in the CRM.
 */
export default function PropertyViewTracker({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    const key = `elite:viewed:${propertyId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage unavailable — still count the view.
    }
    void fetch(`/api/public/properties/${propertyId}/view`, { method: 'POST', keepalive: true }).catch(() => {});
  }, [propertyId]);
  return null;
}
