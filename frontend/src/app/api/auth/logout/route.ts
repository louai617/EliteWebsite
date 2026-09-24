import { apiHandler, ok } from '@/lib/server/http';
import { clearSessionCookie } from '@/lib/server/auth/session';

export const POST = apiHandler(async () => {
  const response = ok({ signedOut: true });
  clearSessionCookie(response);
  return response;
});
