// Non-streaming DeepSeek text helper for auxiliary calls (campaign close etc.).
// The game engine itself streams via /api/ai (see ENGINE_ARMS there, ANT-142).
import { trackAPICall } from './costTracker';

export async function callDeepSeekText(
  prompt: string,
  maxTokens: number,
  track?: { sessionId?: string; userId?: string }
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('DeepSeek text error:', res.status, err.slice(0, 300));
    throw new Error(`DeepSeek API error: ${res.status}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number };
  };

  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const cacheHit = data.usage?.prompt_cache_hit_tokens ?? 0;
  trackAPICall({
    sessionId: track?.sessionId,
    userId: track?.userId,
    provider: 'deepseek',
    type: 'llm',
    model: 'deepseek-v4-flash',
    // Same accounting as the engine: cached tokens at ~10% of the miss rate.
    inputTokens: Math.round(Math.max(0, inputTokens - cacheHit) + cacheHit * 0.1),
    outputTokens: data.usage?.completion_tokens ?? 0,
  }).catch(console.error);

  return data.choices?.[0]?.message?.content ?? '';
}
