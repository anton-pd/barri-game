import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import GameChat from '@/components/GameChat';
import { verifyJwt } from '@/lib/auth';
import { getUserById, getAllAppSettings } from '@/lib/queries';
import { buildAmbientByLocation, readScenarioFile } from '@/lib/scenarioFiles';
import type { GameSession, Message, ScenarioBriefing, NPC } from '@/types';

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

function loadScenarioMeta(
  scenarioId: string,
  dynamicLocations?: Record<string, { name: string }>
): {
  briefing: ScenarioBriefing | null;
  locationNames: Record<string, string>;
  ambientByLocation: Record<string, string>;
  npcs: NPC[];
  rulesetId: string;
} {
  try {
    const scenario = readScenarioFile(scenarioId);
    const locationNames: Record<string, string> = {};
    for (const loc of scenario.locations ?? []) {
      locationNames[loc.id] = loc.name;
    }
    // Situational locations created during play
    for (const [id, loc] of Object.entries(dynamicLocations ?? {})) {
      locationNames[id] = loc.name;
    }
    return {
      briefing: scenario.briefing ?? null,
      locationNames,
      ambientByLocation: buildAmbientByLocation(scenario),
      npcs: scenario.npcs ?? [],
      rulesetId: scenario.rulesetId ?? 'coc_7e',
    };
  } catch {
    return { briefing: null, locationNames: {}, ambientByLocation: {}, npcs: [], rulesetId: 'coc_7e' };
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

  const { briefing, locationNames, ambientByLocation, npcs, rulesetId } = loadScenarioMeta(
    data.session.scenario_id,
    data.session.world_state.dynamicLocations
  );
  const ambientAvailable = process.env.AMBIENT_ENABLED === 'true';

  const settings = await getAllAppSettings();
  const defaultTtsProvider = (settings.tts_provider ?? 'gemini') as 'openai' | 'gemini';

  return (
    <GameChat
      session={data.session}
      initialMessages={data.messages}
      briefing={briefing}
      locationNames={locationNames}
      ambientByLocation={ambientAvailable ? ambientByLocation : {}}
      ambientAvailable={ambientAvailable}
      scenarioNpcs={npcs}
      rulesetId={rulesetId}
      defaultTtsProvider={defaultTtsProvider}
      isAdmin={isAdmin}
    />
  );
}
