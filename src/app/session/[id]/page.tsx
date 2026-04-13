import fs from 'fs';
import path from 'path';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import GameChat from '@/components/GameChat';
import { verifyJwt } from '@/lib/auth';
import { getUserById } from '@/lib/queries';
import type { GameSession, Message, ScenarioBriefing } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getSessionData(id: string): Promise<{ session: GameSession; messages: Message[] } | null> {
  try {
    const { getSession, getMessages } = await import('@/lib/queries');
    const session = await getSession(id);
    if (!session) return null;
    const messages = await getMessages(id);
    return { session, messages };
  } catch {
    return null;
  }
}

function getScenarioBriefing(scenarioId: string): ScenarioBriefing | null {
  try {
    const filePath = path.join(process.cwd(), 'scenarios', `${scenarioId}.json`);
    const scenario = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return scenario.briefing ?? null;
  } catch {
    return null;
  }
}

export default async function SessionPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;

  if (!payload) {
    redirect('/auth/login');
  }

  // Check DB role — JWT role may be stale after role change
  const dbUser = await getUserById(payload.sub);
  if (!dbUser) redirect('/auth/login');
  const isAdmin = dbUser.role === 'admin';

  const { id } = await params;
  const data = await getSessionData(id);

  if (!data) {
    notFound();
  }

  // Ownership check: legacy sessions (user_id = null) are accessible to any authenticated user
  const sessionUserId = data.session.user_id;
  if (sessionUserId !== null && sessionUserId !== payload.sub && !isAdmin) {
    notFound();
  }

  const briefing = getScenarioBriefing(data.session.scenario_id);

  return <GameChat session={data.session} initialMessages={data.messages} briefing={briefing} />;
}
