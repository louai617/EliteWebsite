'use client';

import { useEffect } from 'react';
import { trackListing } from '@/lib/track';

/** Counts one view of the listing when its page opens. */
export default function ListingViewTracker({ reference }: { reference: string }) {
  useEffect(() => {
    trackListing(reference, 'view');
  }, [reference]);
  return null;
}
