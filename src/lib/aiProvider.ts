export type AiProvider = 'deepseek-base' | 'deepseek-pro';

/**
 * Resolve the engine tier from trusted server configuration.
 * Legacy and unknown stored values intentionally fall back to the base tier.
 */
export function resolveAiProvider(value: unknown): AiProvider {
  return value === 'deepseek-pro' ? 'deepseek-pro' : 'deepseek-base';
}
