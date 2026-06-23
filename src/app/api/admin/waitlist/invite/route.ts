import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { sendAccessInviteEmail } from '@/lib/email';
import { ensureSchema, getAdminWaitlist, openWaitlistAccess } from '@/lib/queries';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeLocale(locale: unknown): 'en' | 'uk' | 'es' {
  return locale === 'uk' || locale === 'es' ? locale : 'en';
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyJwt(token) : null;

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const locale = normalizeLocale(body.locale);

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const result = await openWaitlistAccess(email, locale);
    await sendAccessInviteEmail({
      to: result.email,
      locale: result.locale,
      inviteToken: result.inviteToken,
      existingAccount: Boolean(result.existingUser),
    });

    const waitlist = await getAdminWaitlist();
    return NextResponse.json({ ok: true, waitlist });
  } catch (error) {
    console.error('Admin waitlist invite error:', error);
    return NextResponse.json({ error: 'Failed to open access' }, { status: 500 });
  }
}
