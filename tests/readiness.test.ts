import { describe, expect, it } from 'vitest';
import { evaluateReadiness } from '@/lib/readiness';

describe('readiness evaluation', () => {
  it('is ready only when database and scenario source checks pass', async () => {
    await expect(
      evaluateReadiness({
        database: async () => {},
        scenarios: async () => {},
      })
    ).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok', scenarios: 'ok' },
    });
  });

  it('does not expose dependency errors when a critical check fails', async () => {
    await expect(
      evaluateReadiness({
        database: async () => {
          throw new Error('postgres://secret-user:secret-password@db');
        },
        scenarios: async () => {},
      })
    ).resolves.toEqual({
      status: 'unavailable',
      checks: { database: 'failed', scenarios: 'ok' },
    });
  });
});
