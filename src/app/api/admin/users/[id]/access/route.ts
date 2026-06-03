import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { updateUserAccessStatus } from '@/lib/queries';
import type { AccessStatus } from '@/types';

const VALID: AccessStatus[] = ['pending', 'approved', 'blocked'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyJwt(token) : null;

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { access_status } = body as { access_status?: string };

    if (!access_status || !VALID.includes(access_status as AccessStatus)) {
      return NextResponse.json({ error: 'Invalid access_status' }, { status: 400 });
    }

    const user = await updateUserAccessStatus(id, access_status as AccessStatus);
    return NextResponse.json(user);
  } catch (error) {
    console.error('Admin access update error:', error);
    return NextResponse.json({ error: 'Failed to update access status' }, { status: 500 });
  }
}
