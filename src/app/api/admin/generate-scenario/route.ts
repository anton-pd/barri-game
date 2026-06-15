import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { getUserById } from '@/lib/queries';
import { generateScenario } from '@/lib/scenarioGenerator';
import type { GenerateScenarioInput } from '@/lib/scenarioGenerator';

// Scenario generation can take 60–180s on large outputs.
// Force Node runtime and extend max duration so the upstream proxy doesn't cut us off.
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Admin-only
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUserById(payload.sub);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as Partial<GenerateScenarioInput>;
  const { title, titleUk, premise, era, difficulty, minPlayers, maxPlayers, isCampaign, estimatedSessions, language, provider } = body;

  if (!title || !titleUk || !premise || !era || !difficulty) {
    return NextResponse.json({ error: 'title, titleUk, premise, era, difficulty are required' }, { status: 400 });
  }
  if (provider && provider !== 'gemini' && provider !== 'deepseek') {
    return NextResponse.json({ error: "provider must be 'gemini' or 'deepseek'" }, { status: 400 });
  }

  try {
    const result = await generateScenario({
      title,
      titleUk,
      premise,
      era,
      difficulty,
      minPlayers: minPlayers ?? 1,
      maxPlayers: maxPlayers ?? 4,
      isCampaign: isCampaign ?? false,
      estimatedSessions: estimatedSessions ?? 1,
      language: language ?? 'uk',
      provider,
    });

    console.log(
      `[generate-scenario] ok provider=${result.provider} model=${result.model} ` +
      `stop=${result.stopReason} in=${result.inputTokens} out=${result.outputTokens}` +
      (result.fallbackReason ? ' fallback=true' : '')
    );

    return NextResponse.json({
      scenario: result.scenario,
      provider: result.provider,
      model: result.model,
      stopReason: result.stopReason,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      fallbackReason: result.fallbackReason,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generate-scenario] failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
