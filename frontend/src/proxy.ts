import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { SESSION_COOKIE, verifySessionToken } from './lib/server/auth/token';
import { STAFF_ROLES } from './lib/shared/constants';

const intlMiddleware = createMiddleware(routing);

const PROTECTED = new RegExp(`^/(${routing.locales.join('|')})/(dashboard|account)(?:/|$)`);

/**
 * 1. Protected areas: `/<locale>/dashboard` needs a staff session,
 *    `/<locale>/account` needs any session. Unauthenticated visitors are sent
 *    to the login page with a `next` parameter to come back to.
 * 2. Everything else goes through next-intl's locale routing as before.
 *
 * This is a fast first gate (signature + expiry only). Every API route checks
 * the session again against the database, including deactivation and revoked
 * sessions, so the proxy is never the only line of defence.
 */
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const match = pathname.match(PROTECTED);

  if (match) {
    const [, locale, area] = match;
    const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

    if (!claims) {
      const login = new URL(`/${locale}/login`, request.url);
      login.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(login);
    }
    if (area === 'dashboard' && !STAFF_ROLES.includes(claims.role)) {
      return NextResponse.redirect(new URL(`/${locale}/account`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for API routes, Next.js internals and static files
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)'
};
