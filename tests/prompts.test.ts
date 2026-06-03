import { describe, it, expect } from 'vitest';
import { buildSystemPromptBlocks } from '@/lib/prompts';
import { makeScenario, makeWorldState, makePlayer } from './fixtures';

describe('buildSystemPromptBlocks', () => {
  const scenario = makeScenario();
  const players = [makePlayer()];

  it('returns the three cache tiers', () => {
    const blocks = buildSystemPromptBlocks(scenario, makeWorldState(), players);
    expect(blocks).toHaveProperty('ruleset');
    expect(blocks).toHaveProperty('static');
    expect(blocks).toHaveProperty('dynamic');
    expect(blocks.ruleset.length).toBeGreaterThan(0);
    expect(blocks.static).toContain(scenario.systemPrompt);
  });

  it('omits the campaign summary section when no recentSummaries are given', () => {
    const blocks = buildSystemPromptBlocks(scenario, makeWorldState(), players);
    expect(blocks.dynamic).not.toContain('Вечір 1:');
  });

  it('injects prior-session summaries into the dynamic block when provided', () => {
    const recentSummaries = 'Вечір 1: гравці знайшли щоденник і втекли з підвалу.';
    const blocks = buildSystemPromptBlocks(scenario, makeWorldState(), players, {
      campaignContext: { recentSummaries },
    });
    expect(blocks.dynamic).toContain(recentSummaries);
  });

  it('renders the current world state into the dynamic block', () => {
    const ws = makeWorldState({ currentLocation: 'library', discoveredClues: ['лист від матері'] });
    const blocks = buildSystemPromptBlocks(scenario, ws, players);
    expect(blocks.dynamic).toContain('library');
    expect(blocks.dynamic).toContain('лист від матері');
  });

  it('produces an English ruleset/static when language is en', () => {
    const blocks = buildSystemPromptBlocks(scenario, makeWorldState(), players, { language: 'en' });
    expect(blocks.dynamic.length).toBeGreaterThan(0);
    // Player block label differs by language; the en copy uses Latin-script headings.
    expect(blocks.static).toContain(scenario.systemPrompt);
  });
});
