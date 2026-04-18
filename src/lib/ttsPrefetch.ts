/**
 * Server-side in-memory TTS prefetch cache.
 * AI route fires prefetch immediately after generating text.
 * TTS route returns cached WAV without waiting for Gemini.
 *
 * Key: hash of text + narrator voice + segment layout.
 * Retained for 10 min, then evicted.
 */
import crypto from 'crypto';
import { fetchGeminiPcm, pcmToWav } from '@/lib/ttsEngine';
import type { Segment } from '@/lib/segments';

const pending = new Map<string, Promise<Buffer | null>>();

interface PrefetchKeyInput {
  text: string;
  voiceStyle: string;
  segments?: Segment[];
}

function cacheKey(input: PrefetchKeyInput): string {
  const normalizedSegments = (input.segments ?? []).map((segment) =>
    segment.type === 'npc'
      ? {
          type: segment.type,
          name: segment.name,
          voiceStyle: segment.voiceStyle,
          gender: segment.gender ?? null,
          text: segment.text,
        }
      : {
          type: segment.type,
          text: segment.text,
        }
  );

  return crypto
    .createHash('sha1')
    .update(JSON.stringify({
      text: input.text,
      voiceStyle: input.voiceStyle,
      segments: normalizedSegments,
    }))
    .digest('hex');
}

/**
 * Start a Gemini TTS fetch in the background. No-op if already in flight.
 * Called from AI route right after response text is ready.
 */
export function prefetchGemini(
  text: string,
  voiceStyle: string,
  segments?: Segment[]
): void {
  const k = cacheKey({ text, voiceStyle, segments });
  if (pending.has(k)) return;

  const p = fetchGeminiPcm(text, voiceStyle, segments)
    .then((pcm) => (pcm ? pcmToWav(pcm) : null))
    .catch(() => null);

  pending.set(k, p);
  // Evict after 10 min regardless of whether it was consumed
  setTimeout(() => pending.delete(k), 10 * 60 * 1000);
}

/**
 * Retrieve a pending/completed prefetch result.
 * Returns null if not found (caller should fetch normally).
 * Does NOT delete on consume — kept for replay clicks.
 */
export async function getPrefetch(
  text: string,
  voiceStyle: string,
  segments?: Segment[]
): Promise<Buffer | null> {
  return pending.get(cacheKey({ text, voiceStyle, segments })) ?? null;
}
