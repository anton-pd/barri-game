import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAdminUser } from '@/lib/serverAuth';
import { getScenarioMutationAccess } from '@/lib/scenarioMutationGuard';
import {
  deleteScenarioFile,
  getScenarioFilePath,
  isValidScenarioId,
  readScenarioFile,
} from '@/lib/scenarioFiles';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

function deleteCachedAssets(scenarioId: string): boolean {
  const assetDir = path.join(process.cwd(), 'public', 'scenarios', scenarioId);
  if (!fs.existsSync(assetDir)) return false;
  fs.rmSync(assetDir, { recursive: true, force: true });
  return true;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    if (!(await requireAdminUser())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!isValidScenarioId(id)) {
      return NextResponse.json({ error: 'Invalid scenario id' }, { status: 400 });
    }

    try {
      const scenario = readScenarioFile(id);
      const stat = fs.statSync(getScenarioFilePath(id));
      return NextResponse.json({
        scenario,
        file: {
          path: getScenarioFilePath(id),
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        },
      });
    } catch {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Admin scenario detail error:', error);
    return NextResponse.json({ error: 'Failed to load scenario' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    if (!(await requireAdminUser())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const mutationAccess = getScenarioMutationAccess(request.headers.get('host'));
    if (!mutationAccess.allowed) {
      return NextResponse.json({ error: mutationAccess.code }, { status: mutationAccess.status });
    }

    const { id } = await params;
    if (!isValidScenarioId(id)) {
      return NextResponse.json({ error: 'Invalid scenario id' }, { status: 400 });
    }

    const deleted = deleteScenarioFile(id, mutationAccess.permit);
    if (!deleted) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    const deletedCachedAssets = deleteCachedAssets(id);
    return NextResponse.json({ deleted: id, deletedCachedAssets });
  } catch (error) {
    console.error('Admin scenario delete error:', error);
    return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 });
  }
}
