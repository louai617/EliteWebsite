/** Response shapes of the backend API used by this app (see backend/src/services/portal.ts). */

export type Role = 'ADMIN' | 'MANAGER' | 'AGENT' | 'CLIENT';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  clientId: string | null;
  /** Which app this account belongs to. */
  app: 'crm' | 'portal';
  portalUrl: string;
}

export interface AgentContact {
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

export interface PortalProperty {
  id: string;
  reference: string;
  title: string;
  type: string;
  category: 'RESIDENTIAL' | 'COMMERCIAL';
  purpose: 'RENT' | 'SALE';
  status: string;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  area: string;
  city: string;
  buildingName: string | null;
  furnishing: string | null;
  description: string | null;
  images: { url: string; isPrimary: boolean }[];
}

export interface PortalListedProperty extends PortalProperty {
  shortlistedAt: string | null;
  lastViewing: { startsAt: string; status: string } | null;
  deal: { reference: string; status: string } | null;
}

export interface PortalViewing {
  id: string;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  bookedByClient?: boolean;
  agent: AgentContact | null;
  property: PortalProperty;
}

export interface PortalOverview {
  client: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string;
    clientType: string;
    budgetMin: number | null;
    budgetMax: number | null;
    requirements: string | null;
    agent: AgentContact | null;
  };
  counts: { shortlisted: number; upcomingViewings: number; activeDeals: number; openEnquiries: number; openTasks: number; priceDrops: number };
  upcomingViewings: PortalViewing[];
  journey: { steps: string[]; current: number; complete?: boolean };
}

export interface PortalLead {
  id: string;
  stage: string;
  closed: boolean;
  purpose: 'RENT' | 'SALE' | null;
  interestedArea: string | null;
  bedrooms: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  createdAt: string;
  updatedAt: string;
  agent: AgentContact | null;
  properties: { id: string; reference: string; title: string }[];
}

export interface PortalTask {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate: string | null;
  completedAt: string | null;
  assignee: { name: string } | null;
}

export interface PortalDeal {
  id: string;
  reference: string;
  type: 'SALE' | 'RENTAL';
  status: string;
  amount: number;
  contractDate: string | null;
  closingDate: string | null;
  closedAt: string | null;
  createdAt: string;
  property: { id: string; reference: string; title: string; area: string };
  agent: AgentContact | null;
}

export interface PortalReports {
  deals: PortalDeal[];
  summary: { enquiries: number; viewingsCompleted: number; viewingsScheduled: number; dealsOpen: number; dealsCompleted: number };
}

export interface PortalActivityItem {
  id: string;
  kind: 'viewing' | 'deal' | 'shortlist' | 'enquiry' | 'task';
  at: string;
  text: string;
}

/** Listing card as returned by the public API / portal (see lib/listing-types for the full shape). */
export type { ListingCard } from './listing-types';
import type { ListingCard } from './listing-types';

export interface Booking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  awaitingConfirmation: boolean;
  bookedOnline: boolean;
  note: string | null;
  upcoming: boolean;
  canChange: boolean;
  agent: { name: string; phone: string | null; email: string; photo: string | null; whatsapp: string | null } | null;
  address: string;
  directionsUrl: string;
  property: ListingCard;
}

export interface SavedHome {
  savedAt: string;
  priceAtSave: number | null;
  priceChangePercent: number;
  live: boolean;
  property: ListingCard;
}

export interface Recommendation {
  matchPercent: number | null;
  reasons: string[];
  property: ListingCard;
}

export interface Preferences {
  purpose: 'SALE' | 'RENT' | null;
  types: string[];
  areas: string[];
  bedrooms: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  requirements: string | null;
  options: { areas: string[]; types: { value: string; label: string }[] };
}

// ───────── Documents, reservations & payments ─────────

export type ClientDocumentKind = 'QID' | 'PASSPORT' | 'VISA' | 'TRADE_LICENSE' | 'PROOF_OF_PAYMENT' | 'OTHER' | 'CONTRACT' | 'BOOKING_FORM';

export interface PortalDocument {
  id: string;
  kind: ClientDocumentKind;
  title: string | null;
  number: string | null;
  expiresAt: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedByClient: boolean;
  createdAt: string;
  reservationId: string | null;
}

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

export interface Reservation {
  id: string;
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
  canCancel: boolean;
  canUpload: boolean;
  agent: { name: string; phone: string | null; email: string } | null;
  documents: { id: string; kind: string; fileName: string; createdAt: string }[];
  property: ListingCard;
}

export interface ReservationQuote extends PaymentOptions {
  property: { reference: string; title: string; price: number; currency: string; purpose: 'SALE' | 'RENT' };
  available: boolean;
  amount: number;
  currency: string;
  existing: { id: string; reference: string; status: ReservationStatus } | null;
}
