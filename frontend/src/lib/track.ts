import { api } from './api';

export type ListingEvent = 'view' | 'call' | 'whatsapp';

/**
 * Tells the agent app that a listing was viewed or its Call / WhatsApp button pressed
 * (anonymous; counted once per visitor and half hour). Never blocks or breaks the page.
 */
export function trackListing(reference: string, event: ListingEvent) {
  api.post(`/public/properties/${encodeURIComponent(reference)}/track`, { event }).catch(() => undefined);
}
