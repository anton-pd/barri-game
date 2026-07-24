import { NextResponse } from 'next/server';
import { getAllUsers } from '@/lib/queries';
import { requireAdminUser } from '@/lib/serverAuth';

export async function GET() {
  try {
    if (!(await requireAdminUser())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
