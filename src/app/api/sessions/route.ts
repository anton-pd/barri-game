import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessions, getSessionsByUserId, createSession, ensureSchema } from '@/lib/queries';
import { verifyJwt } from '@/lib/auth';
import type { Player } from '@/types';

function getStartingLocation(scenarioId: string): string | undefined {
  try {
    const file = path.join(process.cwd(), 'scenarios', `${scenarioId}.json`);
    const scenario = JSON.parse(fs.readFileSync(file, 'utf-8')) as { startingLocation?: string };
    return scenario.startingLocation;
  } catch {
    return undefined;
  }
}

async function getPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  return token ? verifyJwt(token) : null;
}

export async function GET() {
  try {
    await ensureSchema();

    const payload = await getPayload();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await getSessionsByUserId(payload.sub);

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();

    const payload = await getPayload();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { scenarioId, name, players, language } = body as {
      scenarioId: string;
      name: string;
      players: Player[];
      language?: 'uk' | 'en';
    };

    if (!scenarioId || !name || !players || !Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const startingLocation = getStartingLocation(scenarioId);
    const session = await createSession(scenarioId, name, players, payload.sub, startingLocation, language ?? 'uk');
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
