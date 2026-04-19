import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { ensureSchema, getMessageDebug } from '@/lib/queries';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    await ensureSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyJwt(token) : null;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const row = await getMessageDebug(id);
    if (!row) {
      return NextResponse.json(
        { error: 'No debug data for this message (predates the debug feature or non-assistant message)' },
        { status: 404 }
      );
    }

    return NextResponse.json(row);
  } catch (e) {
    console.error('Message debug error:', e);
    return NextResponse.json({ error: 'Failed to fetch debug' }, { status: 500 });
  }
}
