import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { getUserById } from '@/lib/queries';
import { writeFileSync } from 'fs';
import { join } from 'path';

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

  const { id, json } = await req.json() as { id: string; json: unknown };

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Prevent path traversal — id must be kebab-case only
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id format — use kebab-case only' }, { status: 400 });
  }

  const filePath = join(process.cwd(), 'scenarios', `${id}.json`);

  try {
    writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
    return NextResponse.json({ saved: filePath });
  } catch (err) {
    console.error('Failed to save scenario:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
