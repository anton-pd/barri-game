import { NextResponse } from 'next/server';
import { updateUserAccessStatus } from '@/lib/queries';
import { sendAccessInviteEmail } from '@/lib/email';
import { requireAdminUser } from '@/lib/serverAuth';
import type { AccessStatus } from '@/types';

const VALID: AccessStatus[] = ['pending', 'approved', 'blocked'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdminUser())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { access_status, send_invite } = body as { access_status?: string; send_invite?: boolean };

    if (!access_status || !VALID.includes(access_status as AccessStatus)) {
      return NextResponse.json({ error: 'Invalid access_status' }, { status: 400 });
    }

    const user = await updateUserAccessStatus(id, access_status as AccessStatus);
    if (access_status === 'approved' && send_invite) {
      await sendAccessInviteEmail({
        to: user.email,
        locale: 'en',
        existingAccount: true,
      });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error('Admin access update error:', error);
    return NextResponse.json({ error: 'Failed to update access status' }, { status: 500 });
  }
}
