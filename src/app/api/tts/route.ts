import { getOpenAIVoice } from '@/lib/voices';
import { fetchGeminiPcm, pcmToWav } from '@/lib/ttsEngine';
import { getPrefetch } from '@/lib/ttsPrefetch';
import type { Segment } from '@/lib/segments';

export async function POST(request: Request) {
  const { text, voiceStyle, provider = 'openai', segments } = (await request.json()) as {
    text: string;
    voiceStyle?: string;
    provider?: 'openai' | 'gemini';
    segments?: Segment[];
  };

  if (!text?.trim()) {
    return new Response('text is required', { status: 400 });
  }

  if (provider === 'gemini') {
    return handleGemini(text, voiceStyle ?? 'keeper', segments);
  }
  return handleOpenAI(text, voiceStyle ?? 'keeper');
}

// ── Gemini (with prefetch cache) ─────────────────────────────────────────────

async function handleGemini(text: string, voiceStyle: string, segments?: Segment[]): Promise<Response> {
  // Check prefetch cache first — AI route may have started this already
  const cached = await getPrefetch(text);
  if (cached) {
    return wavResponse(cached);
  }

  // Cache miss: fetch now (happens when prefetch hasn't finished or wasn't started)
  const pcm = await fetchGeminiPcm(text, voiceStyle, segments);
  if (!pcm) return new Response('TTS failed', { status: 502 });

  return wavResponse(pcmToWav(pcm));
}

function wavResponse(wav: Buffer): Response {
  return new Response(wav.buffer as ArrayBuffer, {
    headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
  });
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function handleOpenAI(text: string, voiceStyle: string): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('OpenAI API key not configured', { status: 503 });

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: getOpenAIVoice(voiceStyle),
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    console.error('OpenAI TTS error:', res.status, await res.text());
    return new Response('TTS failed', { status: 502 });
  }

  return new Response(await res.arrayBuffer(), {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}
