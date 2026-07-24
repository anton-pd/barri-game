import { NextResponse } from 'next/server';
import { ensureSchema, getMessageDebug } from '@/lib/queries';
import { requireAdminUser } from '@/lib/serverAuth';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    await ensureSchema();

    if (!(await requireAdminUser())) {
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
