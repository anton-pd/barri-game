import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, ensureSchema } from '@/lib/queries';
import { signJwt, setAuthCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = await getUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.email_verified) {
      return NextResponse.json(
        { error: 'email_not_verified', message: 'Please verify your email before logging in.' },
        { status: 403 }
      );
    }

    const token = await signJwt({ sub: user.id, email: user.email, role: user.role });
    const response = NextResponse.json({ ok: true });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
