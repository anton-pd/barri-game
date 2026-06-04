import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { Scenario } from '@/types';
import { getScenariosDir, listScenarioFiles } from '@/lib/scenarioFiles';

export async function GET() {
  try {
    const scenariosDir = getScenariosDir();
    const files = listScenarioFiles();

    const publicScenariosDir = path.join(process.cwd(), 'public', 'scenarios');

    const scenarios: Scenario[] = files.map((file) => {
      const content = fs.readFileSync(path.join(scenariosDir, file), 'utf-8');
      const scenario = JSON.parse(content) as Scenario;

      // Cover priority (ANT-99, cached assets only — never generates here):
      //   1. dedicated painterly pulp-poster cover.jpg (scripts/generate-covers.mjs)
      //   2. first staticImage whose file exists on disk
      let cover: string | undefined;
      if (fs.existsSync(path.join(publicScenariosDir, scenario.id, 'cover.jpg'))) {
        cover = `/scenarios/${scenario.id}/cover.jpg`;
      } else {
        for (const img of scenario.staticImages ?? []) {
          if (fs.existsSync(path.join(publicScenariosDir, scenario.id, `${img.id}.jpg`))) {
            cover = `/scenarios/${scenario.id}/${img.id}.jpg`;
            break;
          }
        }
      }
      return { ...scenario, cover };
    });

    return NextResponse.json(scenarios);
  } catch (error) {
    console.error('Error reading scenarios:', error);
    return NextResponse.json({ error: 'Failed to load scenarios' }, { status: 500 });
  }
}
