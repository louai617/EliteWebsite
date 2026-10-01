import type { Metadata } from 'next';
import { PortalShell } from '@/components/portal/portal-shell';

export const metadata: Metadata = { title: 'Client portal', robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
