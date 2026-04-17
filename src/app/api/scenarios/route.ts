import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { Scenario } from '@/types';
import { getScenariosDir, listScenarioFiles } from '@/lib/scenarioFiles';

export async function GET() {
  try {
    const scenariosDir = getScenariosDir();
    const files = listScenarioFiles();

    const scenarios: Scenario[] = files.map((file) => {
      const content = fs.readFileSync(path.join(scenariosDir, file), 'utf-8');
      return JSON.parse(content) as Scenario;
    });

    return NextResponse.json(scenarios);
  } catch (error) {
    console.error('Error reading scenarios:', error);
    return NextResponse.json({ error: 'Failed to load scenarios' }, { status: 500 });
  }
}
