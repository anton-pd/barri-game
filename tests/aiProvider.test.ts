import { describe, expect, it } from 'vitest';
import { resolveAiProvider } from '@/lib/aiProvider';

describe('server AI provider selection', () => {
  it('enables the pro tier only for the explicit server setting', () => {
    expect(resolveAiProvider('deepseek-pro')).toBe('deepseek-pro');
  });

  it.each([
    undefined,
    null,
    '',
    'deepseek-base',
    'deepseek-flash',
    'gemini-flash',
    'claude-sonnet',
    { aiProvider: 'deepseek-pro' },
  ])('falls back to the base tier for legacy or untrusted value %j', (value) => {
    expect(resolveAiProvider(value)).toBe('deepseek-base');
  });
});
