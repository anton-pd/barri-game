const STYLE_MAP: Record<string, string> = {
  newspaper: 'newspaper clipping 1920s black and white aged paper old typography print',
  map:       'hand-drawn map 1920s aged parchment sepia ink cartographic illustration',
  letter:    'handwritten letter 1920s yellowed aged paper fountain pen personal correspondence',
  photo:     'vintage photograph 1920s sepia tones grainy aged darkroom',
  artifact:  'mysterious occult artifact dark background 1920s museum exhibit detailed',
  scene:     '1920s horror illustration dark atmosphere noir cinematic detailed',
};

function buildPrompt(prompt: string, type: string): string {
  const style = STYLE_MAP[type] ?? STYLE_MAP.scene;
  return `${prompt}, ${style}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('prompt')?.trim();
  const type   = searchParams.get('type') ?? 'scene';

  if (!prompt) return new Response('prompt is required', { status: 400 });

  const fullPrompt = buildPrompt(prompt, type);
  const provider   = process.env.IMAGE_PROVIDER ?? 'gemini';

  if (provider === 'gemini') {
    return handleGemini(fullPrompt);
  }

  if (provider === 'openai') {
    return handleOpenAI(fullPrompt);
  }

  return handlePollinations(fullPrompt);
}

// ── Gemini ───────────────────────────────────────────────────────────────────

async function handleGemini(prompt: string): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response('Gemini API key not configured', { status: 503 });

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 5000 * attempt));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    );

    if (res.status === 429) {
      console.warn(`Gemini rate limit, attempt ${attempt + 1}/3`);
      continue;
    }

    if (!res.ok) {
      console.error('Gemini image error:', res.status, await res.text());
      return new Response('Image generation failed', { status: 502 });
    }

    const data = await res.json() as {
      candidates: { content: { parts: { inlineData?: { mimeType: string; data: string } }[] } }[]
    };

    const imagePart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!imagePart?.inlineData) {
      console.error('Gemini: no image in response', JSON.stringify(data).slice(0, 200));
      return new Response('No image returned', { status: 502 });
    }

    const { mimeType, data: b64 } = imagePart.inlineData;
    const buf = Buffer.from(b64, 'base64');
    return new Response(buf, {
      headers: { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=86400' },
    });
  }

  console.warn('Gemini: rate limit after 3 attempts, falling back to Pollinations');
  return handlePollinations(prompt);
}

// ── OpenAI DALL-E ─────────────────────────────────────────────────────────────

async function handleOpenAI(prompt: string): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('OpenAI key not configured', { status: 503 });

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'dall-e-2', prompt, n: 1, size: '512x512', response_format: 'url' }),
  });

  if (!res.ok) {
    console.error('DALL-E error:', await res.text());
    return new Response('Image generation failed', { status: 502 });
  }

  const data = await res.json() as { data: { url: string }[] };
  const imgRes = await fetch(data.data[0].url);
  const imgBuf = await imgRes.arrayBuffer();
  return new Response(imgBuf, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
  });
}

// ── Pollinations (fallback) ───────────────────────────────────────────────────

async function handlePollinations(prompt: string): Promise<Response> {
  const encoded = encodeURIComponent(prompt);
  const seed    = Math.floor(Math.random() * 999999);
  const url     = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&model=flux-realism&nologo=true&seed=${seed}`;
  const JPEG_MAGIC = [0xff, 0xd8, 0xff];

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 8000 * attempt));
    const res = await fetch(url, { headers: { 'User-Agent': 'cthulhu-game/1.0' } });
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isJpeg = bytes[0] === JPEG_MAGIC[0] && bytes[1] === JPEG_MAGIC[1] && bytes[2] === JPEG_MAGIC[2];
    if (isJpeg) {
      return new Response(buf, {
        headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
      });
    }
    console.warn(`Pollinations attempt ${attempt + 1} non-JPEG (${buf.byteLength}b)`);
  }

  console.error('Pollinations failed after 3 attempts');
  return new Response('Image generation failed', { status: 502 });
}
