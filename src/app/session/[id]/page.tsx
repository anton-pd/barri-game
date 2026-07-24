import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import GameChat from '@/components/GameChat';
import { verifyJwt } from '@/lib/auth';
import { getUserById, getAllAppSettings } from '@/lib/queries';
import { buildAmbientByLocation, readScenarioFile } from '@/lib/scenarioFiles';
import type { GameSession, Message, ScenarioBriefing, NPC, Player } from '@/types';
import { evaluateSessionAccess } from '@/lib/sessionAccess';
import {
  localizePlayersForScenario,
  localizeScenarioForPlayer,
} from '@/lib/scenarioPlayerLocalization';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getSessionData(id: string): Promise<{ session: GameSession; messages: Message[] } | null> {
  const { getSession, getMessages } = await import('@/lib/queries');
  const session = await getSession(id);
  if (!session) return null;
  const messages = await getMessages(id);
  return { session, messages };
}

function loadScenarioMeta(
  scenarioId: string,
  language: 'uk' | 'en',
  players: Player[],
  dynamicLocations?: Record<string, { name: string }>
): {
  briefing: ScenarioBriefing | null;
  locationNames: Record<string, string>;
  ambientByLocation: Record<string, string>;
  npcs: NPC[];
  rulesetId: string;
  players: Player[];
} {
  try {
    const scenario = localizeScenarioForPlayer(readScenarioFile(scenarioId), language);
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
      players: localizePlayersForScenario(players, scenario),
    };
  } catch {
    return {
      briefing: null,
      locationNames: {},
      ambientByLocation: {},
      npcs: [],
      rulesetId: 'coc_7e',
      players,
    };
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

  const sessionAccess = evaluateSessionAccess({ authenticatedUserId: payload.sub, currentUser: dbUser, session: data.session });
  if (!sessionAccess.ok) {
    notFound();
  }

  const { briefing, locationNames, ambientByLocation, npcs, rulesetId, players } = loadScenarioMeta(
    data.session.scenario_id,
    data.session.language ?? 'uk',
    data.session.players,
    data.session.world_state.dynamicLocations
  );
  const ambientAvailable = process.env.AMBIENT_ENABLED === 'true';

  const settings = await getAllAppSettings();
  const defaultTtsProvider = (settings.tts_provider ?? 'gemini') as 'openai' | 'gemini';

  return (
    <GameChat
      session={{ ...data.session, players }}
      initialMessages={data.messages}
      briefing={briefing}
      locationNames={locationNames}
      ambientByLocation={ambientAvailable ? ambientByLocation : {}}
      ambientAvailable={ambientAvailable}
      scenarioNpcs={npcs}
      rulesetId={rulesetId}
      defaultTtsProvider={defaultTtsProvider}
      isAdmin={isAdmin}
      viewerUserId={dbUser.id}
    />
  );
}
