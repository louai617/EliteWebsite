'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * The CRM dashboard has its own sidebar and header, so the public site's
 * navbar, footer and chat widget are not rendered there.
 */
export default function HideOnDashboard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (/^\/[a-z]{2}\/dashboard(\/|$)/.test(pathname ?? '')) return null;
  return <>{children}</>;
}
