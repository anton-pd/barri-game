import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionsByUserId, createSession, ensureSchema, getUserById } from '@/lib/queries';
import { verifyJwt } from '@/lib/auth';
import type { Player } from '@/types';
import { createCampaign } from '@/lib/campaigns';
import { evaluateAccessGate } from '@/lib/accessGate';
import { readScenarioFile } from '@/lib/scenarioFiles';

function getScenarioSessionMeta(scenarioId: string): {
  startingLocation?: string;
  variantId?: string;
  variantHint?: string;
  isCampaign: boolean;
} {
  try {
    const scenario = readScenarioFile(scenarioId) as {
      startingLocation?: string;
      variants?: { id: string; startingLocation: string; introHint?: string }[];
      sessionConfig?: { isCampaign?: boolean };
    };
    if (scenario.variants && scenario.variants.length > 0) {
      const variant = scenario.variants[Math.floor(Math.random() * scenario.variants.length)];
      return {
        startingLocation: variant.startingLocation,
        variantId: variant.id,
        variantHint: variant.introHint,
        isCampaign: scenario.sessionConfig?.isCampaign ?? false,
      };
    }
    return {
      startingLocation: scenario.startingLocation,
      isCampaign: scenario.sessionConfig?.isCampaign ?? false,
    };
  } catch {
    return { isCampaign: false };
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

    // Waiting-list gate (ANT-108): only approved users may start sessions.
    // Session creation is cost-free, so the daily cap is not enforced here.
    const gateUser = await getUserById(payload.sub);
    if (!gateUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const gate = evaluateAccessGate({
      role: gateUser.role,
      accessStatus: gateUser?.access_status ?? 'pending',
      enforceDailyCap: false,
      dailyLimitEnabled: false,
      dailyLimitUsd: 0,
      spentTodayUsd: 0,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.code, message: gate.message }, { status: gate.status });
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

    const { startingLocation, variantId, variantHint, isCampaign } = getScenarioSessionMeta(scenarioId);

    // Campaign scenarios (sessionConfig.isCampaign) get a campaign record so
    // evenings can be chained: finish-evening carries world_state forward and
    // creates the next session (ANT-77..ANT-81). Session 1 uses the normal
    // starting world state — inheritance only matters from evening 2 onward.
    let campaignOptions: { campaignId: string; sessionNumber: number } | undefined;
    if (isCampaign) {
      const campaign = await createCampaign(payload.sub, scenarioId, name);
      campaignOptions = { campaignId: campaign.id, sessionNumber: 1 };
    }

    const session = await createSession(
      scenarioId,
      name,
      players,
      payload.sub,
      startingLocation,
      language ?? 'uk',
      variantId,
      variantHint,
      campaignOptions
    );
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
