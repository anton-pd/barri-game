import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { Scenario, StaticImage } from '@/types';
import { requireCurrentDbAdmin } from '@/lib/paidMediaAccess';
import { ensureScenarioStaticImagesGenerated } from '@/lib/staticImages';
import { readScenarioFile } from '@/lib/scenarioFiles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireCurrentDbAdmin(request);
  if (!access.ok) return access.response;

  const { id } = await params;

  let scenario: Scenario;
  try {
    scenario = readScenarioFile(id);
  } catch {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  const result = await ensureScenarioStaticImagesGenerated({ scenarioId: id, scenario });
  return NextResponse.json(result);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let scenario: Scenario;
  try {
    scenario = readScenarioFile(id);
  } catch {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  const images   = scenario.staticImages ?? [];
  const dir      = path.join(process.cwd(), 'public', 'scenarios', id);

  const results = images
    .filter((img: StaticImage) => fs.existsSync(path.join(dir, `${img.id}.jpg`)))
    .map((img: StaticImage) => ({ id: img.id, url: `/scenarios/${id}/${img.id}.jpg`, label: img.label }));

  return NextResponse.json({ images: results });
}
