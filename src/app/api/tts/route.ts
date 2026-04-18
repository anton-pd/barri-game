// CHANGED: Added cost tracking per TTS call. Auth token read to get userId.
import { cookies } from 'next/headers';
import { getOpenAIKeeperVoice } from '@/lib/voices';
import { fetchGeminiPcm, pcmToWav } from '@/lib/ttsEngine';
import { getPrefetch } from '@/lib/ttsPrefetch';
import { verifyJwt } from '@/lib/auth';
import { trackAPICall } from '@/lib/costTracker';
import type { Segment } from '@/lib/segments';

export async function POST(request: Request) {
  const { text, voiceStyle, provider = 'openai', segments, sessionId } = (await request.json()) as {
    text: string;
    voiceStyle?: string;
    provider?: 'openai' | 'gemini';
    segments?: Segment[];
    sessionId?: string;
  };

  if (!text?.trim()) {
    return new Response('text is required', { status: 400 });
  }

  // Get userId for cost tracking (optional — tracking is best-effort)
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;
  const userId = payload?.sub;

  if (provider === 'gemini') {
    const res = await handleGemini(text, voiceStyle ?? 'keeper', segments, sessionId, userId);
    // Auto-fallback to OpenAI if Gemini quota exceeded or unavailable
    if (res.status === 502) {
      console.warn('Gemini TTS failed, falling back to OpenAI');
      return handleOpenAI(text, voiceStyle ?? 'keeper', sessionId, userId);
    }
    return res;
  }
  return handleOpenAI(text, voiceStyle ?? 'keeper', sessionId, userId);
}

// ── Gemini (with prefetch cache) ─────────────────────────────────────────────

async function handleGemini(
  text: string,
  voiceStyle: string,
  segments?: Segment[],
  sessionId?: string,
  userId?: string
): Promise<Response> {
  // Check prefetch cache first
  const cached = await getPrefetch(text, voiceStyle, segments);
  if (cached) {
    // Cached — no API cost
    return wavResponse(cached);
  }

  const pcm = await fetchGeminiPcm(text, voiceStyle, segments);
  if (!pcm) return new Response('TTS failed', { status: 502 });

  // Track Gemini TTS: input = text tokens, output = audio tokens (approx same as input)
  if (userId) {
    const tokens = Math.ceil(text.length / 4);
    trackAPICall({
      sessionId,
      userId,
      provider: 'gemini',
      type: 'tts',
      model: 'gemini-2.5-flash-preview-tts',
      inputTokens: tokens,
      outputTokens: tokens,
      characters: text.length,
    }).catch(console.error);
  }

  return wavResponse(pcmToWav(pcm));
}

function wavResponse(wav: Buffer): Response {
  return new Response(wav.buffer as ArrayBuffer, {
    headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
  });
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function handleOpenAI(
  text: string,
  _voiceStyle: string,
  sessionId?: string,
  userId?: string
): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('OpenAI API key not configured', { status: 503 });

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: getOpenAIKeeperVoice(),
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    console.error('OpenAI TTS error:', res.status, await res.text());
    return new Response('TTS failed', { status: 502 });
  }

  // CHANGED: Track OpenAI TTS cost (non-blocking)
  if (userId) {
    trackAPICall({
      sessionId,
      userId,
      provider: 'openai',
      type: 'tts',
      model: 'tts-1',
      characters: text.length,
    }).catch(console.error);
  }

  return new Response(await res.arrayBuffer(), {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}
