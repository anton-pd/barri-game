import { notFound } from 'next/navigation';
import GameChat from '@/components/GameChat';
import type { GameSession, Message } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getSessionData(id: string): Promise<{ session: GameSession; messages: Message[] } | null> {
  try {
    const { getSession, getMessages } = await import('@/lib/queries');
    const session = await getSession(id);
    if (!session) return null;
    const messages = await getMessages(id, 30);
    return { session, messages };
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

  return <GameChat session={data.session} initialMessages={data.messages} />;
}
