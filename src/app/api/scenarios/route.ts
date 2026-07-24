import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { Scenario } from '@/types';
import { getScenariosDir, listScenarioFiles } from '@/lib/scenarioFiles';
import { toScenarioCatalogEntry, type ScenarioCatalogEntry } from '@/lib/scenarioCatalog';

export async function GET() {
  try {
    const scenariosDir = getScenariosDir();
    const files = listScenarioFiles();

    const publicScenariosDir = path.join(process.cwd(), 'public', 'scenarios');

    const scenarios: ScenarioCatalogEntry[] = files.map((file) => {
      const content = fs.readFileSync(path.join(scenariosDir, file), 'utf-8');
      const scenario = JSON.parse(content) as Scenario;

      // Dedicated non-evidence cover only. Never use a static clue/material as
      // catalog art: doing so can reveal it before the session unlocks it.
      let cover: string | undefined;
      if (fs.existsSync(path.join(publicScenariosDir, scenario.id, 'cover.jpg'))) {
        cover = `/scenarios/${scenario.id}/cover.jpg`;
      }
      return toScenarioCatalogEntry(scenario, cover);
    });

    return NextResponse.json(scenarios);
  } catch (error) {
    console.error('Error reading scenarios:', error);
    return NextResponse.json({ error: 'Failed to load scenarios' }, { status: 500 });
  }
}
