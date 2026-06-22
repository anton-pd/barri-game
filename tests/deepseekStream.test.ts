import { describe, expect, it } from 'vitest';
import { buildDeepSeekChatBody, extractDeepSeekContentDelta } from '@/lib/deepseekStream';

describe('deepseekStream helpers', () => {
  it('disables thinking mode for game chat requests', () => {
    const body = buildDeepSeekChatBody({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 1200,
      temperature: 0.7,
    });

    expect(body).toMatchObject({
      model: 'deepseek-v4-flash',
      max_tokens: 1200,
      temperature: 0.7,
      stream: true,
      stream_options: { include_usage: true },
      thinking: { type: 'disabled' },
    });
  });

  it('uses OpenRouter reasoning controls for the pro path', () => {
    const body = buildDeepSeekChatBody({
      model: 'deepseek/deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 1200,
      temperature: 0.7,
      orProvider: 'Cloudflare',
    });

    expect(body.thinking).toBeUndefined();
    expect(body).toMatchObject({
      provider: { order: ['Cloudflare'], allow_fallbacks: true },
      usage: { include: true },
      reasoning: { effort: 'none', exclude: true },
    });
  });

  it('does not treat reasoning-only deltas as player-visible content', () => {
    expect(extractDeepSeekContentDelta({
      choices: [{ delta: { reasoning_content: 'hidden chain of thought' } }],
    })).toBe('');

    expect(extractDeepSeekContentDelta({
      choices: [{ delta: { content: 'visible narration' } }],
    })).toBe('visible narration');
  });
});
