import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  createUserFromWaitlistInvite,
  ensureSchema,
  getUserByEmail,
  getWaitlistInviteByToken,
} from '@/lib/queries';
import { signJwt, setAuthCookie } from '@/lib/auth';

const PASSWORD_MIN = 8;

function invalidRegistration() {
  return NextResponse.json(
    {
      error: 'registration_closed',
      message: 'Direct registration is closed. Join the waiting list for access.',
    },
    { status: 403 }
  );
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const invite = url.searchParams.get('invite')?.trim();

    if (!invite) return invalidRegistration();

    const invitation = await getWaitlistInviteByToken(invite);
    if (!invitation) {
      return NextResponse.json({ error: 'invalid_invite' }, { status: 404 });
    }

    const existingUser = await getUserByEmail(invitation.email);
    return NextResponse.json({
      email: invitation.email,
      locale: invitation.invite_locale ?? invitation.locale ?? 'en',
      expires_at: invitation.invite_expires,
      account_exists: Boolean(existingUser),
    });
  } catch (error) {
    console.error('Invite lookup error:', error);
    return NextResponse.json({ error: 'Failed to check invitation' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const inviteToken = typeof body.inviteToken === 'string' ? body.inviteToken.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!inviteToken) return invalidRegistration();

    const invitation = await getWaitlistInviteByToken(inviteToken);
    if (!invitation) {
      return NextResponse.json({ error: 'invalid_invite' }, { status: 404 });
    }

    if (password.length < PASSWORD_MIN) {
      return NextResponse.json(
        { error: 'weak_password', message: `Password must be at least ${PASSWORD_MIN} characters.` },
        { status: 400 }
      );
    }

    const existingUser = await getUserByEmail(invitation.email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'account_exists', message: 'This email already has an account. Please sign in instead.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUserFromWaitlistInvite(inviteToken, passwordHash);
    if (!user) {
      return NextResponse.json({ error: 'invalid_invite' }, { status: 404 });
    }

    const jwt = await signJwt({ sub: user.id, email: user.email, role: user.role });
    const response = NextResponse.json({ ok: true });
    setAuthCookie(response, jwt);
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration unavailable' }, { status: 500 });
  }
}
