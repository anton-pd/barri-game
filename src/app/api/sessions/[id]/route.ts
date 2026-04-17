import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, updateSession, deleteSession, getMessages } from '@/lib/queries';
import { verifyJwt } from '@/lib/auth';
import type { WorldState, Player } from '@/types';

async function getPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  return token ? verifyJwt(token) : null;
}

function canAccess(sessionUserId: string | null, payloadSub: string, role: string): boolean {
  if (role === 'admin') return true;
  if (sessionUserId === null) return true; // legacy anonymous session
  return sessionUserId === payloadSub;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!canAccess(session.user_id, payload.sub, payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await getMessages(id, 30);
    return NextResponse.json({ session, messages });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!canAccess(session.user_id, payload.sub, payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session is read-only' }, { status: 409 });
    }

    const body = await request.json();
    const updates: { world_state?: WorldState; act?: number; players?: Player[]; status?: 'active' | 'completed' | 'paused' } = {};

    if (body.world_state !== undefined) updates.world_state = body.world_state;
    if (body.act !== undefined) updates.act = body.act;
    if (body.players !== undefined) updates.players = body.players;
    if (body.status !== undefined) {
      if (!['active', 'completed', 'paused'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }

    const updated = await updateSession(id, updates);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!canAccess(session.user_id, payload.sub, payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteSession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
