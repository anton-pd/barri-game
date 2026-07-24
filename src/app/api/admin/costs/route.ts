import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/queries';
import { requireAdminUser } from '@/lib/serverAuth';
import {
  getAdminOverview, getUserCosts, getSessionCosts,
  getModelBreakdown, getSessionBreakdownEnhanced, getAccountsBreakdown, getScenarioBreakdown,
  getAnonymousDemoBreakdown,
  type Period,
} from '@/lib/costTracker';

export async function GET(request: Request) {
  try {
    await ensureSchema();

    if (!(await requireAdminUser())) {
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
    if (breakdown === 'scenarios')         return NextResponse.json(await getScenarioBreakdown());
    if (breakdown === 'anonymous-demo')    return NextResponse.json(await getAnonymousDemoBreakdown(period, date));

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
