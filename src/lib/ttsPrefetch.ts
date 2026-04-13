/**
 * Server-side in-memory TTS prefetch cache.
 * AI route fires prefetch immediately after generating text.
 * TTS route returns cached WAV without waiting for Gemini.
 *
 * Key: first 300 chars of response text (unique enough per response).
 * Retained for 10 min, then evicted.
 */
import { fetchGeminiPcm, pcmToWav } from '@/lib/ttsEngine';
import type { Segment } from '@/lib/segments';

const pending = new Map<string, Promise<Buffer | null>>();

function cacheKey(text: string): string {
  return text.slice(0, 300);
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
  const k = cacheKey(text);
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
export async function getPrefetch(text: string): Promise<Buffer | null> {
  return pending.get(cacheKey(text)) ?? null;
}
