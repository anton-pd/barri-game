import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { Scenario, StaticImage } from '@/types';

const STYLE_MAP: Record<string, string> = {
  newspaper: 'newspaper clipping 1920s black and white aged paper old typography print',
  map:       'hand-drawn map 1920s aged parchment sepia ink cartographic illustration',
  letter:    'handwritten letter 1920s yellowed aged paper fountain pen personal correspondence',
  photo:     'vintage photograph 1920s sepia tones grainy aged darkroom',
  artifact:  'mysterious occult artifact dark background 1920s museum exhibit detailed',
  scene:     '1920s horror illustration dark atmosphere noir cinematic detailed',
};

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function isValidJpeg(buf: Buffer): boolean {
  return buf.length > 3 && buf.slice(0, 3).equals(JPEG_MAGIC);
}

async function generateImage(prompt: string, type: string): Promise<Buffer> {
  const style    = STYLE_MAP[type] ?? STYLE_MAP.scene;
  const full     = `${prompt}, ${style}`;
  const provider = process.env.IMAGE_PROVIDER ?? 'pollinations';

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY!;
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-2', prompt: full, n: 1, size: '512x512', response_format: 'url' }),
    });
    const data = await res.json() as { data: { url: string }[] };
    const imgRes = await fetch(data.data[0].url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (!isValidJpeg(buf)) throw new Error('Invalid JPEG from DALL-E');
    return buf;
  }

  // Pollinations.ai — sequential, with retry on rate limit
  const encoded = encodeURIComponent(full);
  const seed    = Math.floor(Math.random() * 999999);
  const url     = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&model=flux-realism&nologo=true&seed=${seed}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 8000 * attempt));
    const res = await fetch(url, { headers: { 'User-Agent': 'cthulhu-game/1.0' } });
    const buf = Buffer.from(await res.arrayBuffer());
    if (isValidJpeg(buf)) return buf;
    console.warn(`Pollinations attempt ${attempt + 1} returned non-JPEG (${buf.length}b), retrying...`);
  }
  throw new Error('Pollinations returned invalid image after 3 attempts');
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scenarioPath = path.join(process.cwd(), 'scenarios', `${id}.json`);
  if (!fs.existsSync(scenarioPath)) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8')) as Scenario;
  const images   = scenario.staticImages ?? [];

  if (images.length === 0) {
    return NextResponse.json({ images: [] });
  }

  const dir = path.join(process.cwd(), 'public', 'scenarios', id);
  fs.mkdirSync(dir, { recursive: true });

  const results: { id: string; url: string; label: string }[] = [];

  for (const img of images) {
    const filePath = path.join(dir, `${img.id}.jpg`);
    const url      = `/scenarios/${id}/${img.id}.jpg`;

    if (!fs.existsSync(filePath)) {
      try {
        const buf = await generateImage(img.prompt, img.type);
        fs.writeFileSync(filePath, buf);
        console.log(`Generated static image: ${img.id}`);
      } catch (err) {
        console.error(`Failed to generate ${img.id}:`, err);
        // Skip this image, don't fail the whole batch
        continue;
      }
    }

    results.push({ id: img.id, url, label: img.label });
  }

  return NextResponse.json({ images: results });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scenarioPath = path.join(process.cwd(), 'scenarios', `${id}.json`);
  if (!fs.existsSync(scenarioPath)) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8')) as Scenario;
  const images   = scenario.staticImages ?? [];
  const dir      = path.join(process.cwd(), 'public', 'scenarios', id);

  const results = images
    .filter((img: StaticImage) => fs.existsSync(path.join(dir, `${img.id}.jpg`)))
    .map((img: StaticImage) => ({ id: img.id, url: `/scenarios/${id}/${img.id}.jpg`, label: img.label }));

  return NextResponse.json({ images: results });
}
