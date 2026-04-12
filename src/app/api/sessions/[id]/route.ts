import { NextResponse } from 'next/server';
import { getSession, updateSession, deleteSession, getMessages } from '@/lib/queries';
import type { WorldState, Player } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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
    const { id } = await params;
    const body = await request.json();
    const updates: { world_state?: WorldState; act?: number; players?: Player[]; status?: string } = {};

    if (body.world_state !== undefined) updates.world_state = body.world_state;
    if (body.act !== undefined) updates.act = body.act;
    if (body.players !== undefined) updates.players = body.players;
    if (body.status !== undefined) updates.status = body.status;

    const session = await updateSession(id, updates);
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteSession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
