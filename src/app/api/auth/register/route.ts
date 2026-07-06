import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  createSelfServeUser,
  createUserFromWaitlistInvite,
  ensureSchema,
  getAllAppSettings,
  getUserByEmail,
  getWaitlistInviteByToken,
} from '@/lib/queries';
import { sendVerificationEmail } from '@/lib/email';
import { signJwt, setAuthCookie } from '@/lib/auth';

const PASSWORD_MIN = 8;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ANT-190: registration_mode app setting. 'open' (default) = self-serve
// signup; 'waitlist' = the ANT-180 invite-only flow. Admin toggles it in
// Case Curator Settings.
async function isOpenRegistration(): Promise<boolean> {
  const settings = await getAllAppSettings();
  return (settings.registration_mode ?? 'open') !== 'waitlist';
}

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

    // No invite token → the client is asking which intake mode to render.
    if (!invite) {
      return NextResponse.json({ open: await isOpenRegistration() });
    }

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

    // ── Self-serve path (ANT-190) ────────────────────────────────────────────
    if (!inviteToken) {
      if (!(await isOpenRegistration())) return invalidRegistration();

      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json(
          { error: 'invalid_email', message: 'A valid email address is required.' },
          { status: 400 }
        );
      }
      if (password.length < PASSWORD_MIN) {
        return NextResponse.json(
          { error: 'weak_password', message: `Password must be at least ${PASSWORD_MIN} characters.` },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const created = await createSelfServeUser(email, passwordHash);
      if (!created) {
        return NextResponse.json(
          { error: 'account_exists', message: 'This email already has an account. Please sign in instead.' },
          { status: 409 }
        );
      }

      // Login requires a verified email, so no auth cookie here — the user
      // confirms the address first (same flow as password reset).
      await sendVerificationEmail({ to: email, token: created.verifyToken });
      return NextResponse.json({ ok: true, mode: 'verify' });
    }

    // ── Invite path (ANT-180, unchanged) ─────────────────────────────────────
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
