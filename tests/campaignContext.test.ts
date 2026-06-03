import { describe, it, expect, vi, beforeEach } from 'vitest';

// campaigns.ts instantiates `new Anthropic()` at module load and imports DB
// queries — mock both so we can unit-test the pure formatting in getCampaignContext.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn() };
  },
}));

const getRecentSessionSummaries = vi.fn();
vi.mock('@/lib/queries', () => ({
  getRecentSessionSummaries: (...args: unknown[]) => getRecentSessionSummaries(...args),
  createCampaignRecord: vi.fn(),
  saveSessionSummary: vi.fn(),
}));

import { getCampaignContext } from '@/lib/campaigns';

describe('getCampaignContext (ANT-80)', () => {
  beforeEach(() => getRecentSessionSummaries.mockReset());

  it('formats summaries chronologically as "Вечір N: ..."', async () => {
    // queries returns newest-first; getCampaignContext reverses to oldest-first.
    getRecentSessionSummaries.mockResolvedValue([
      { sessionNumber: 2, summary: 'Друга ніч у маєтку.' },
      { sessionNumber: 1, summary: 'Перша ніч у бібліотеці.' },
    ]);
    const ctx = await getCampaignContext('camp-1');
    expect(ctx.recentSummaries).toBe(
      'Вечір 1: Перша ніч у бібліотеці.\nВечір 2: Друга ніч у маєтку.'
    );
  });

  it('returns an empty string when there are no prior summaries', async () => {
    getRecentSessionSummaries.mockResolvedValue([]);
    const ctx = await getCampaignContext('camp-1');
    expect(ctx.recentSummaries).toBe('');
  });
});
