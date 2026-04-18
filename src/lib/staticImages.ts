import fs from 'fs';
import path from 'path';
import type { Scenario } from '@/types';

const STYLE_MAP: Record<string, string> = {
  newspaper: 'newspaper clipping 1920s black and white aged paper old typography print',
  map: 'hand-drawn map 1920s aged parchment sepia ink cartographic illustration',
  letter: 'handwritten letter 1920s yellowed aged paper fountain pen personal correspondence',
  photo: 'vintage photograph 1920s sepia tones grainy aged darkroom',
  artifact: 'mysterious occult artifact dark background 1920s museum exhibit detailed',
  scene: '1920s horror illustration dark atmosphere noir cinematic detailed',
};

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export interface StaticImageGenerationResult {
  images: { id: string; url: string; label: string }[];
  generated: string[];
  failed: { id: string; error: string }[];
}

function isValidJpeg(buf: Buffer): boolean {
  return buf.length > 3 && buf.slice(0, 3).equals(JPEG_MAGIC);
}

function getScenarioImageDir(scenarioId: string): string {
  return path.join(process.cwd(), 'public', 'scenarios', scenarioId);
}

function getScenarioImageUrl(scenarioId: string, imageId: string): string {
  return `/scenarios/${scenarioId}/${imageId}.jpg`;
}

function getScenarioImagePath(scenarioId: string, imageId: string): string {
  return path.join(getScenarioImageDir(scenarioId), `${imageId}.jpg`);
}

async function generateImage(prompt: string, type: string): Promise<Buffer> {
  const style = STYLE_MAP[type] ?? STYLE_MAP.scene;
  const full = `${prompt}, ${style}`;
  const provider = process.env.IMAGE_PROVIDER ?? 'gemini';

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY!;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: full }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 5000 * attempt));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      );
      if (res.status === 429) {
        console.warn(`Gemini rate limit attempt ${attempt + 1}`);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini error ${res.status}`);

      const data = await res.json() as {
        candidates: { content: { parts: { inlineData?: { mimeType: string; data: string } }[] } }[]
      };
      const part = data.candidates?.[0]?.content?.parts?.find((candidate) => candidate.inlineData);
      if (!part?.inlineData) throw new Error('Gemini: no image in response');
      return Buffer.from(part.inlineData.data, 'base64');
    }

    throw new Error('Gemini: rate limit after 3 attempts');
  }

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

  const encoded = encodeURIComponent(full);
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&model=flux-realism&nologo=true&seed=${seed}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 8000 * attempt));
    const res = await fetch(url, { headers: { 'User-Agent': 'cthulhu-game/1.0' } });
    const buf = Buffer.from(await res.arrayBuffer());
    if (isValidJpeg(buf)) return buf;
    console.warn(`Pollinations attempt ${attempt + 1} returned non-JPEG (${buf.length}b), retrying...`);
  }

  throw new Error('Pollinations returned invalid image after 3 attempts');
}

export async function ensureScenarioStaticImagesGenerated(params: {
  scenarioId: string;
  scenario: Scenario;
}): Promise<StaticImageGenerationResult> {
  const { scenarioId, scenario } = params;
  const images = scenario.staticImages ?? [];

  if (images.length === 0) {
    return { images: [], generated: [], failed: [] };
  }

  fs.mkdirSync(getScenarioImageDir(scenarioId), { recursive: true });

  const results: { id: string; url: string; label: string }[] = [];
  const generated: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const image of images) {
    const filePath = getScenarioImagePath(scenarioId, image.id);
    const url = getScenarioImageUrl(scenarioId, image.id);

    if (!fs.existsSync(filePath)) {
      try {
        const buf = await generateImage(image.prompt, image.type);
        fs.writeFileSync(filePath, buf);
        generated.push(image.id);
        console.log(`Generated static image: ${image.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to generate ${image.id}:`, error);
        failed.push({ id: image.id, error: message });
        continue;
      }
    }

    results.push({ id: image.id, url, label: image.label });
  }

  return { images: results, generated, failed };
}
