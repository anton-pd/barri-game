import { NextResponse } from 'next/server';
import { ensureSchema, upsertWaitlistEntry } from '@/lib/queries';
import { enforceRateLimit } from '@/lib/publicRateLimit';
import { readJsonWithLimit } from '@/lib/requestLimits';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_OUTCOMES = new Set(['completed', 'message_limit', 'manual']);

export async function POST(request: Request) {
  try {
    await ensureSchema();

    const ipLimit = enforceRateLimit(request, 'waitlist-ip', { limit: 10, windowMs: 60 * 60_000 });
    if (ipLimit) return ipLimit;
    const body = await readJsonWithLimit(request, 16 * 1024) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const source = typeof body.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, 80)
      : 'unknown';
    const locale = typeof body.locale === 'string' ? body.locale.trim().slice(0, 12) : undefined;
    const outcome = typeof body.outcome === 'string' && ALLOWED_OUTCOMES.has(body.outcome)
      ? body.outcome
      : undefined;
    const rawMessageCount = typeof body.messageCount === 'number' ? body.messageCount : NaN;
    const messageCount = Number.isFinite(rawMessageCount)
      ? Math.max(0, Math.min(100, Math.floor(rawMessageCount)))
      : undefined;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : undefined;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    const identityLimit = enforceRateLimit(request, 'waitlist-id', { limit: 3, windowMs: 24 * 60 * 60_000 }, email);
    if (identityLimit) return identityLimit;

    await upsertWaitlistEntry({
      email,
      source,
      locale,
      outcome,
      messageCount,
      notes,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Waitlist error:', error);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ ok: true, devOnly: true });
    }
    return NextResponse.json({ error: 'Waitlist submission failed' }, { status: 500 });
  }
}
