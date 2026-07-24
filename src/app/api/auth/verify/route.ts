import { verifyUserEmail } from '@/lib/queries';
import { signJwt } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { enforceRateLimit } from '@/lib/publicRateLimit';

function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? 'https://barrigame.es').replace(/\/$/, '');
  return `${base}${path}`;
}

export async function GET(request: NextRequest) {
  const limit = enforceRateLimit(request, 'auth-verify-ip', { limit: 30, windowMs: 60 * 60_000 });
  if (limit) return limit;
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(appUrl('/auth/verify?error=invalid'));
  }

  const user = await verifyUserEmail(token);
  if (!user) {
    return NextResponse.redirect(appUrl('/auth/verify?error=invalid'));
  }

  const jwt = await signJwt({ sub: user.id, email: user.email, role: user.role });
  const response = NextResponse.redirect(appUrl('/'));
  response.cookies.set('auth_token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
