import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAdminUser } from '@/lib/serverAuth';
import type { Scenario } from '@/types';
import { getScenariosDir, listScenarioFiles, readScenarioFile } from '@/lib/scenarioFiles';

export const runtime = 'nodejs';

interface AdminScenarioSummary {
  id: string;
  title: string;
  titleUk?: string;
  era: string;
  difficulty: Scenario['difficulty'];
  rulesetId?: string;
  fileName: string;
  fileSize: number;
  updatedAt: string;
  hasCachedAssets: boolean;
  generatedBy?: Scenario['generatedBy'];
}

function buildScenarioSummary(fileName: string): AdminScenarioSummary {
  const scenarioId = fileName.replace(/\.json$/, '');
  const scenario = readScenarioFile(scenarioId);
  const filePath = path.join(getScenariosDir(), fileName);
  const stat = fs.statSync(filePath);
  const cachedAssetDir = path.join(process.cwd(), 'public', 'scenarios', scenarioId);

  return {
    id: scenario.id,
    title: scenario.title,
    titleUk: scenario.titleUk,
    era: scenario.era,
    difficulty: scenario.difficulty,
    rulesetId: scenario.rulesetId,
    fileName,
    fileSize: stat.size,
    updatedAt: stat.mtime.toISOString(),
    hasCachedAssets: fs.existsSync(cachedAssetDir),
    generatedBy: scenario.generatedBy,
  };
}

export async function GET() {
  try {
    if (!(await requireAdminUser())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scenarios = listScenarioFiles()
      .map(buildScenarioSummary)
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({
      scenariosDir: getScenariosDir(),
      scenarios,
    });
  } catch (error) {
    console.error('Admin scenarios list error:', error);
    return NextResponse.json({ error: 'Failed to load scenarios' }, { status: 500 });
  }
}
