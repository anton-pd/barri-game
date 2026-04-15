import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { getUserById } from '@/lib/queries';
import { generateScenario } from '@/lib/scenarioGenerator';
import type { GenerateScenarioInput } from '@/lib/scenarioGenerator';

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
  const { title, titleUk, premise, era, difficulty, minPlayers, maxPlayers, isCampaign, estimatedSessions, language } = body;

  if (!title || !titleUk || !premise || !era || !difficulty) {
    return NextResponse.json({ error: 'title, titleUk, premise, era, difficulty are required' }, { status: 400 });
  }

  try {
    const scenario = await generateScenario({
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
    });
    return NextResponse.json({ scenario });
  } catch (err) {
    console.error('Scenario generation failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
