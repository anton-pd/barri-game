import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByResetToken, updatePasswordAndClearResetToken, ensureSchema } from '@/lib/queries';
import { enforceRateLimit } from '@/lib/publicRateLimit';
import { readJsonWithLimit } from '@/lib/requestLimits';

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const ipLimit = enforceRateLimit(request, 'auth-reset-ip', { limit: 10, windowMs: 60 * 60_000 });
    if (ipLimit) return ipLimit;
    const body = await readJsonWithLimit(request, 16 * 1024) as Record<string, unknown>;
    const { token, password } = body as { token?: string; password?: string };

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }
    const tokenLimit = enforceRateLimit(request, 'auth-reset-token', { limit: 5, windowMs: 60 * 60_000 }, token);
    if (tokenLimit) return tokenLimit;
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const user = await getUserByResetToken(token);
    if (!user) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await updatePasswordAndClearResetToken(user.id, passwordHash);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
