import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/**
 * The website has no visitor accounts. Old links are redirected:
 *  - sign-in / password reset → the agent app (the "Agent portal")
 *  - the old client dashboard and sign-up → the home page (saved homes → /saved)
 */
const AGENT_PATH = /^\/(?:en|ar)\/(?:login|forgot-password|dashboard\/admin)(?:\/|$)/;
const SAVED_PATH = /^\/(en|ar)\/dashboard\/saved(?:\/|$)/;
const GONE_PATH = /^\/(en|ar)\/(?:register|dashboard)(?:\/|$)/;

function crmUrl(path = '/') {
  const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api').replace(/\/$/, '');
  return `${(process.env.NEXT_PUBLIC_CRM_URL || api.replace(/\/api$/, '')).replace(/\/$/, '')}${path}`;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (AGENT_PATH.test(pathname)) return NextResponse.redirect(crmUrl(pathname.includes('forgot-password') ? '/forgot-password' : '/login'));
  const saved = pathname.match(SAVED_PATH);
  if (saved) return NextResponse.redirect(new URL(`/${saved[1]}/saved`, request.url));
  const gone = pathname.match(GONE_PATH);
  if (gone) return NextResponse.redirect(new URL(`/${gone[1]}`, request.url));
  return intl(request);
}

export const config = {
  // Match all pathnames except for API routes, Next.js internals and static files
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)'
};
