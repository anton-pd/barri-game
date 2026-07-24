import { NextRequest, NextResponse } from 'next/server';
import { getAllAppSettings, setAppSetting, ensureSchema } from '@/lib/queries';
import { requireAdminUser } from '@/lib/serverAuth';

export async function GET() {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureSchema();
  const settings = await getAllAppSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureSchema();
  const body = await req.json() as { key: string; value: string };
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }

  await setAppSetting(key, value);
  return NextResponse.json({ ok: true });
}
