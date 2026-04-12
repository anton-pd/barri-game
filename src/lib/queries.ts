import sql from './db';
import type { GameSession, Message, WorldState, Player } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonOf(v: unknown): any {
  return JSON.parse(JSON.stringify(v));
}

export async function initializeSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scenario_id VARCHAR(100) NOT NULL,
      name VARCHAR(200) NOT NULL,
      act INTEGER DEFAULT 1,
      status VARCHAR(20) DEFAULT 'active',
      world_state JSONB DEFAULT '{}',
      players JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      player_idx INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)
  `;
}

export async function getSessions(): Promise<(GameSession & { last_message?: string })[]> {
  const rows = await sql`
    SELECT
      gs.*,
      m.content as last_message
    FROM game_sessions gs
    LEFT JOIN LATERAL (
      SELECT content FROM messages
      WHERE session_id = gs.id
      ORDER BY created_at DESC
      LIMIT 1
    ) m ON true
    WHERE gs.status = 'active'
    ORDER BY gs.updated_at DESC
  `;
  return rows as unknown as (GameSession & { last_message?: string })[];
}

export async function createSession(
  scenarioId: string,
  name: string,
  players: Player[]
): Promise<GameSession> {
  const initialWorldState: WorldState = {
    act: 1,
    visitedLocations: [],
    discoveredClues: [],
    npcRelations: {},
    summary: '',
    openThreads: [],
    playerNotes: [],
  };

  const rows = await sql`
    INSERT INTO game_sessions (scenario_id, name, players, world_state)
    VALUES (
      ${scenarioId},
      ${name},
      ${sql.json(jsonOf(players))},
      ${sql.json(jsonOf(initialWorldState))}
    )
    RETURNING *
  `;
  return rows[0] as unknown as GameSession;
}

export async function getSession(id: string): Promise<GameSession | null> {
  const rows = await sql`
    SELECT * FROM game_sessions WHERE id = ${id}
  `;
  return (rows[0] as unknown as GameSession) || null;
}

export async function updateSession(
  id: string,
  updates: { world_state?: WorldState; act?: number; players?: Player[]; status?: string }
): Promise<GameSession> {
  if (updates.world_state !== undefined) {
    await sql`
      UPDATE game_sessions SET world_state = ${sql.json(jsonOf(updates.world_state))}, updated_at = NOW() WHERE id = ${id}
    `;
  }
  if (updates.act !== undefined) {
    await sql`UPDATE game_sessions SET act = ${updates.act}, updated_at = NOW() WHERE id = ${id}`;
  }
  if (updates.players !== undefined) {
    await sql`
      UPDATE game_sessions SET players = ${sql.json(jsonOf(updates.players))}, updated_at = NOW() WHERE id = ${id}
    `;
  }
  if (updates.status !== undefined) {
    await sql`UPDATE game_sessions SET status = ${updates.status}, updated_at = NOW() WHERE id = ${id}`;
  }

  const rows = await sql`SELECT * FROM game_sessions WHERE id = ${id}`;
  return rows[0] as unknown as GameSession;
}

export async function deleteSession(id: string): Promise<void> {
  await sql`DELETE FROM game_sessions WHERE id = ${id}`;
}

export async function getMessages(sessionId: string, limit = 30): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows as unknown as Message[];
}

export async function getLastNMessages(sessionId: string, n: number): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM (
      SELECT * FROM messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT ${n}
    ) sub
    ORDER BY created_at ASC
  `;
  return rows as unknown as Message[];
}

export async function countMessages(sessionId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int as count FROM messages WHERE session_id = ${sessionId}
  `;
  return rows[0].count as number;
}

export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  playerIdx?: number
): Promise<Message> {
  const rows = await sql`
    INSERT INTO messages (session_id, role, content, player_idx)
    VALUES (${sessionId}, ${role}, ${content}, ${playerIdx ?? null})
    RETURNING *
  `;
  return rows[0] as unknown as Message;
}

export async function getAllMessages(sessionId: string): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `;
  return rows as unknown as Message[];
}
