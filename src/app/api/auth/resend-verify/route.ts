import { NextResponse } from 'next/server';
import { getUserByEmail, regenerateVerifyToken } from '@/lib/queries';
import { sendVerificationEmail } from '@/lib/email';
import { enforceRateLimit } from '@/lib/publicRateLimit';
import { readJsonWithLimit } from '@/lib/requestLimits';

export async function POST(request: Request) {
  try {
    const ipLimit = enforceRateLimit(request, 'auth-resend-ip', { limit: 10, windowMs: 60 * 60_000 });
    if (ipLimit) return ipLimit;
    const body = await readJsonWithLimit(request, 8 * 1024) as Record<string, unknown>;
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const identityLimit = enforceRateLimit(request, 'auth-resend-id', { limit: 3, windowMs: 60 * 60_000 }, normalizedEmail);
    if (identityLimit) return identityLimit;
    const user = await getUserByEmail(normalizedEmail);

    // Return success even if email not found (prevent enumeration)
    if (!user || user.email_verified) {
      return NextResponse.json({ message: 'If this account exists, a new verification email has been sent.' });
    }

    const { token, tooSoon } = await regenerateVerifyToken(normalizedEmail);
    if (tooSoon) {
      return NextResponse.json(
        { error: 'Please wait a few minutes before requesting another verification email.' },
        { status: 429 }
      );
    }

    if (token) {
      await sendVerificationEmail({ to: normalizedEmail, token });
    }

    return NextResponse.json({ message: 'If this account exists, a new verification email has been sent.' });
  } catch (error) {
    console.error('Resend verify error:', error);
    return NextResponse.json({ error: 'Failed to resend verification email' }, { status: 500 });
  }
}
