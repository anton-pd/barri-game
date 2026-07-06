import { NextRequest, NextResponse } from 'next/server';
import { getAllAppSettings, setAppSetting, ensureSchema } from '@/lib/queries';

import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';

// ANT-190: these settings gate registration mode, engine tier and cost caps —
// they must never be writable (or readable) without an admin session.
async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;
  return Boolean(payload && payload.role === 'admin');
}


export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureSchema();
  const settings = await getAllAppSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureSchema();
  const body = await req.json() as { key: string; value: string };
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }

  await setAppSetting(key, value);
  return NextResponse.json({ ok: true });
}
