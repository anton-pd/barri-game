// CHANGED: New admin endpoint for API cost overview
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { getAdminOverview, getUserCosts, getSessionCosts } from '@/lib/costTracker';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyJwt(token) : null;

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const costs = await getSessionCosts(sessionId);
      return NextResponse.json(costs);
    }

    if (userId) {
      const days = Number(searchParams.get('days') ?? '30');
      const costs = await getUserCosts(userId, days);
      return NextResponse.json(costs);
    }

    const overview = await getAdminOverview();
    return NextResponse.json(overview);
  } catch (error) {
    console.error('Admin costs error:', error);
    return NextResponse.json({ error: 'Failed to fetch costs' }, { status: 500 });
  }
}
