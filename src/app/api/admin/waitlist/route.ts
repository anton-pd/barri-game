import { NextResponse } from 'next/server';
import { ensureSchema, getAdminWaitlist } from '@/lib/queries';
import { requireAdminUser } from '@/lib/serverAuth';

export async function GET() {
  try {
    await ensureSchema();
    if (!(await requireAdminUser())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const waitlist = await getAdminWaitlist();
    return NextResponse.json(waitlist);
  } catch (error) {
    console.error('Admin waitlist error:', error);
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
  }
}
