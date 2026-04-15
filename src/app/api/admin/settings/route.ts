import { NextRequest, NextResponse } from 'next/server';
import { getAllAppSettings, setAppSetting, ensureSchema } from '@/lib/queries';

export async function GET() {
  await ensureSchema();
  const settings = await getAllAppSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const body = await req.json() as { key: string; value: string };
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }

  await setAppSetting(key, value);
  return NextResponse.json({ ok: true });
}
