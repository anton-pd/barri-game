import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { getUserAccountExport, ensureSchema } from '@/lib/queries';

// GET /api/account/export — GDPR Art. 20 data portability (ANT-159).
// Streams everything tied to the authenticated user as a downloadable JSON file.
export async function GET() {
  try {
    await ensureSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getUserAccountExport(payload.sub);
    if (!data) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const filename = `barri-data-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Account export error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
