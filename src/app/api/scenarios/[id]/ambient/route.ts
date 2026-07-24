import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { ensureScenarioAmbientGenerated } from '@/lib/ambient';
import { buildAmbientByLocation, readScenarioFile } from '@/lib/scenarioFiles';

function ambientDisabledResponse() {
  return NextResponse.json({
    ambientByLocation: {},
    generated: [],
    disabled: true,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.AMBIENT_ENABLED !== 'true') {
    return ambientDisabledResponse();
  }

  const { id } = await params;

  try {
    const scenario = readScenarioFile(id);
    return NextResponse.json({
      ambientByLocation: buildAmbientByLocation(scenario),
    });
  } catch {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.AMBIENT_ENABLED !== 'true') {
    return ambientDisabledResponse();
  }

  const { id } = await params;

  try {
    const scenario = readScenarioFile(id);

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyJwt(token) : null;

    const result = await ensureScenarioAmbientGenerated({
      scenarioId: id,
      scenario,
      userId: payload?.sub,
      // Cache generation supports beta play, but public gameplay must never
      // persist a metadata mutation into the shared production scenario JSON.
      persistScenario: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Ambient generation failed:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
