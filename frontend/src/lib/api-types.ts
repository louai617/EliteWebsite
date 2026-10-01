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
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
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
  counts: { shortlisted: number; upcomingViewings: number; activeDeals: number; openEnquiries: number; openTasks: number };
  upcomingViewings: PortalViewing[];
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
