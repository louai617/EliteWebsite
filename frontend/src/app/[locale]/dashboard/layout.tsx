import React from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';

export const metadata = {
  title: 'CRM Dashboard',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
