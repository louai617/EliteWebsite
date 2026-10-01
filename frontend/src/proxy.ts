import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/** The old static admin dashboard now lives in the CRM (backend app). */
const ADMIN_PATH = /^\/(?:en|ar)\/dashboard\/admin(?:\/|$)/;

function crmUrl() {
  const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api').replace(/\/$/, '');
  return `${(process.env.NEXT_PUBLIC_CRM_URL || api.replace(/\/api$/, '')).replace(/\/$/, '')}/`;
}

export default function proxy(request: NextRequest) {
  if (ADMIN_PATH.test(request.nextUrl.pathname)) return NextResponse.redirect(crmUrl());
  return intl(request);
}

export const config = {
  // Match all pathnames except for API routes, Next.js internals and static files
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)'
};
