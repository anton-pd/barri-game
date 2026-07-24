import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/serverAuth';
import type { Scenario, ScenarioGeneratedBy } from '@/types';
import { writeScenarioFile } from '@/lib/scenarioFiles';
import { ensureScenarioAmbientGenerated } from '@/lib/ambient';
import { ensureScenarioStaticImagesGenerated } from '@/lib/staticImages';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface SaveMaterialError {
  stage: 'images' | 'ambient';
  error: string;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, json, generatedBy } = await req.json() as {
    id: string;
    json: unknown;
    generatedBy?: ScenarioGeneratedBy;
  };

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Prevent path traversal — id must be kebab-case only
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id format — use kebab-case only' }, { status: 400 });
  }

  try {
    const scenario = {
      ...(json as Scenario),
      ...(generatedBy ? { generatedBy } : {}),
    } satisfies Scenario;
    writeScenarioFile(id, scenario);

    let imageResult = {
      images: [] as { id: string; url: string; label: string }[],
      generated: [] as string[],
      failed: [] as { id: string; error: string }[],
    };
    let ambientResult = {
      ambientByLocation: {} as Record<string, string>,
      generated: [] as { id: string; kind: 'group' | 'location'; url: string; locationIds: string[] }[],
    };
    const materialErrors: SaveMaterialError[] = [];

    try {
      imageResult = await ensureScenarioStaticImagesGenerated({ scenarioId: id, scenario });
    } catch (error) {
      materialErrors.push({
        stage: 'images',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (process.env.AMBIENT_ENABLED === 'true') {
      try {
        ambientResult = await ensureScenarioAmbientGenerated({ scenarioId: id, scenario, userId: admin.id });
      } catch (error) {
        materialErrors.push({
          stage: 'ambient',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      saved: id,
      generatedBy: scenario.generatedBy ?? null,
      images: imageResult.images,
      generatedImageIds: imageResult.generated,
      imageFailures: imageResult.failed,
      ambientByLocation: ambientResult.ambientByLocation,
      generatedAmbientIds: ambientResult.generated.map((item) => item.id),
      materialErrors,
    });
  } catch (err) {
    console.error('Failed to save scenario:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
