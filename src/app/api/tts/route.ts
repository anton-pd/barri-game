import { getOpenAIKeeperVoice } from '@/lib/voices';
import { fetchGeminiPcm, pcmToWav } from '@/lib/ttsEngine';
import { getPrefetch } from '@/lib/ttsPrefetch';
import { trackAPICall } from '@/lib/costTracker';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { requirePaidSessionAccess } from '@/lib/paidMediaAccess';
import {
  InvalidJsonError,
  isValidSessionId,
  PAID_MEDIA_LIMITS,
  PayloadTooLargeError,
  readJsonWithLimit,
} from '@/lib/requestLimits';
import type { Segment } from '@/lib/segments';

const OPENAI_TTS_TIMEOUT_MS = 30_000;

function isSegment(value: unknown): value is Segment {
  if (!value || typeof value !== 'object') return false;
  const segment = value as Partial<Segment>;
  if (segment.type === 'narration') {
    return typeof segment.text === 'string';
  }
  return (
    segment.type === 'npc' &&
    typeof segment.text === 'string' &&
    typeof segment.name === 'string' &&
    typeof segment.voiceStyle === 'string' &&
    (segment.gender === undefined || segment.gender === 'male' || segment.gender === 'female')
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonWithLimit(request, PAID_MEDIA_LIMITS.ttsBodyBytes);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return new Response('Payload too large', { status: 413 });
    }
    if (error instanceof InvalidJsonError) {
      return new Response('Invalid JSON', { status: 400 });
    }
    throw error;
  }

  if (!body || typeof body !== 'object') {
    return new Response('Invalid request body', { status: 400 });
  }

  const {
    text,
    voiceStyle,
    provider = 'openai',
    segments,
    sessionId,
  } = body as Record<string, unknown>;

  if (typeof text !== 'string' || !text.trim()) {
    return new Response('text is required', { status: 400 });
  }
  if (text.length > PAID_MEDIA_LIMITS.ttsTextChars) {
    return new Response('text is too long', { status: 413 });
  }
  if (!isValidSessionId(sessionId)) {
    return new Response('valid sessionId is required', { status: 400 });
  }
  if (provider !== 'openai' && provider !== 'gemini') {
    return new Response('invalid provider', { status: 400 });
  }
  if (voiceStyle !== undefined && (typeof voiceStyle !== 'string' || voiceStyle.length > 64)) {
    return new Response('invalid voiceStyle', { status: 400 });
  }
  if (
    segments !== undefined &&
    (
      !Array.isArray(segments) ||
      segments.length > PAID_MEDIA_LIMITS.ttsSegments ||
      !segments.every(isSegment) ||
      segments.reduce(
        (total, segment) => total + (isSegment(segment) ? segment.text.length : 0),
        0,
      ) > PAID_MEDIA_LIMITS.ttsTextChars
    )
  ) {
    return new Response('invalid segments', { status: 400 });
  }

  const access = await requirePaidSessionAccess(request, sessionId);
  if (!access.ok) return access.response;

  try {
    if (provider === 'gemini') {
      const res = await handleGemini(
        text,
        typeof voiceStyle === 'string' ? voiceStyle : 'keeper',
        segments as Segment[] | undefined,
        sessionId,
        access.user.id,
      );
      // Auto-fallback to OpenAI if Gemini quota exceeded or unavailable
      if (res.status === 502) {
        console.warn('Gemini TTS failed, falling back to OpenAI');
        return handleOpenAI(
          text,
          typeof voiceStyle === 'string' ? voiceStyle : 'keeper',
          sessionId,
          access.user.id,
        );
      }
      return res;
    }
    return handleOpenAI(
      text,
      typeof voiceStyle === 'string' ? voiceStyle : 'keeper',
      sessionId,
      access.user.id,
    );
  } catch (error) {
    console.error('TTS request failed:', error);
    return new Response('TTS timed out or failed', { status: 504 });
  }
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

  const res = await fetchWithTimeout('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: getOpenAIKeeperVoice(),
      response_format: 'mp3',
    }),
  }, OPENAI_TTS_TIMEOUT_MS);

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
