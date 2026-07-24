import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMessages, saveMessage, getSession, getUserById } from '@/lib/queries';
import { verifyJwt } from '@/lib/auth';
import { evaluateSessionAccess } from '@/lib/sessionAccess';

async function getPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  return token ? verifyJwt(token) : null;
}

export async function GET(request: Request) {
  try {
    const payload = await getPayload();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '30');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    const access = evaluateSessionAccess({ authenticatedUserId: payload.sub, currentUser: await getUserById(payload.sub), session });
    if (!access.ok) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await getMessages(sessionId, limit);
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await getPayload();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, role, content, playerIdx } = body;

    if (!sessionId || !role || !content) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    const access = evaluateSessionAccess({ authenticatedUserId: payload.sub, currentUser: await getUserById(payload.sub), session });
    if (!access.ok) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const message = await saveMessage(sessionId, role, content, playerIdx);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}
