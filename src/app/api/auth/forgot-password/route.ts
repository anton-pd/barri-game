import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserByEmail, setPasswordResetToken, ensureSchema } from '@/lib/queries';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(normalizedEmail);

    // Always return 200 — no email enumeration
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await setPasswordResetToken(user.id, resetToken);
      // Fire-and-forget — don't leak timing info
      sendPasswordResetEmail({ to: normalizedEmail, token: resetToken }).catch(
        (err) => console.error('Failed to send password reset email:', err)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
