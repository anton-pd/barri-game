import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import GameChat from '@/components/GameChat';
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
  const { id } = await params;
  const data = await getSessionData(id);

  if (!data) {
    notFound();
  }

  const briefing = getScenarioBriefing(data.session.scenario_id);

  return <GameChat session={data.session} initialMessages={data.messages} briefing={briefing} />;
}
