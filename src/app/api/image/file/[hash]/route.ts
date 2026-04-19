import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'public', 'scenarios', 'dynamic');

// Serves a runtime-generated dynamic image directly from the shared volume.
// Bypasses Next.js standalone's build-time public/ manifest, which does not
// pick up files created after server start.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  const clean = hash.replace(/\.jpg$/i, '');
  if (!/^[a-f0-9]{24}$/i.test(clean)) {
    return new Response('Invalid hash', { status: 400 });
  }
  const file = path.join(CACHE_DIR, `${clean}.jpg`);
  try {
    const buf = fs.readFileSync(file);
    return new Response(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
