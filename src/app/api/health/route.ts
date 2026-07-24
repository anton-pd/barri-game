import fs from 'fs';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { evaluateReadiness } from '@/lib/readiness';
import { getScenariosDir, listScenarioFiles } from '@/lib/scenarioFiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Minimal public readiness signal for deploy smoke checks. */
export async function GET() {
  const readiness = await evaluateReadiness({
    database: async () => {
      await sql`SELECT 1`;
    },
    scenarios: async () => {
      fs.accessSync(getScenariosDir(), fs.constants.R_OK);
      if (listScenarioFiles().length === 0) {
        throw new Error('No scenario files available');
      }
    },
  });

  return NextResponse.json(readiness, {
    status: readiness.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
