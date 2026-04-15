import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import {
  getAdminOverview, getUserCosts, getSessionCosts,
  getModelBreakdown, getSessionBreakdownEnhanced, getAccountsBreakdown,
  type Period,
} from '@/lib/costTracker';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyJwt(token) : null;

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const breakdown = searchParams.get('breakdown');
    const userId    = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');
    const period    = (searchParams.get('period') ?? 'month') as Period;
    const date      = searchParams.get('date') ?? undefined;

    if (breakdown === 'model')             return NextResponse.json(await getModelBreakdown(period, date));
    if (breakdown === 'sessions-enhanced') return NextResponse.json(await getSessionBreakdownEnhanced());
    if (breakdown === 'accounts')          return NextResponse.json(await getAccountsBreakdown(period, date));

    if (sessionId) return NextResponse.json(await getSessionCosts(sessionId));

    if (userId) {
      const days = Number(searchParams.get('days') ?? '30');
      return NextResponse.json(await getUserCosts(userId, days));
    }

    return NextResponse.json(await getAdminOverview());
  } catch (error) {
    console.error('Admin costs error:', error);
    return NextResponse.json({ error: 'Failed to fetch costs' }, { status: 500 });
  }
}
