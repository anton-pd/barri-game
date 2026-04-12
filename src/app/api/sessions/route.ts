import { NextResponse } from 'next/server';
import { getSessions, createSession, initializeSchema } from '@/lib/queries';
import type { Player } from '@/types';

let schemaInitialized = false;

async function ensureSchema() {
  if (!schemaInitialized) {
    await initializeSchema();
    schemaInitialized = true;
  }
}

export async function GET() {
  try {
    await ensureSchema();
    const sessions = await getSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { scenarioId, name, players } = body as {
      scenarioId: string;
      name: string;
      players: Player[];
    };

    if (!scenarioId || !name || !players || !Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const session = await createSession(scenarioId, name, players);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
