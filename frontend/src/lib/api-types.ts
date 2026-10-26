/**
 * Shapes returned by the agent app's public API (the website has no visitor accounts).
 * Listing cards live in lib/listing-types.
 */
export type { ListingCard } from './listing-types';
import type { ListingCard } from './listing-types';

/** POST /public/viewings */
export interface GuestBooking {
  startsAt: string;
  endsAt: string;
  address: string;
  title: string;
  reference: string;
  agent: { name: string; phone: string | null } | null;
  directionsUrl: string;
}

// ───────── Reservations & payments ─────────

export interface BankDetails {
  bankName: string | null;
  accountName: string | null;
  iban: string | null;
  accountNumber: string | null;
  swift: string | null;
  fawranAlias: string | null;
  instructions: string | null;
}

export interface PaymentMethodOption {
  method: 'FAWRAN' | 'CARD';
  label: string;
  enabled: boolean;
  comingSoon: boolean;
}

export interface PaymentOptions {
  methods: PaymentMethodOption[];
  bank: BankDetails;
  holdHours: number;
}

export type ReservationStatus = 'AWAITING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'CANCELLED';

/** GET /public/reservations/quote */
export interface ReservationQuote extends PaymentOptions {
  property: { reference: string; title: string; price: number; currency: string; purpose: 'SALE' | 'RENT' };
  available: boolean;
  amount: number;
  currency: string;
}

/** GET /public/reservations/:token — the visitor's private reservation page. */
export interface GuestReservation extends PaymentOptions {
  reference: string;
  status: ReservationStatus;
  amount: number;
  currency: string;
  method: 'FAWRAN' | 'CARD';
  payBy: string;
  payerName: string | null;
  paymentReference: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  name: string;
  agent: { name: string; phone: string | null; email: string } | null;
  property: ListingCard;
  receipts: { fileName: string; uploadedAt: string }[];
  canUpload: boolean;
  canCancel: boolean;
}
