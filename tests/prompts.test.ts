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

  it('documents and renders the living case plan', () => {
    const ws = makeWorldState({
      casePlan: {
        items: [
          { id: 'check_archives', label: 'Перевірити міські архіви', status: 'available' },
        ],
      },
    });
    const blocks = buildSystemPromptBlocks(scenario, ws, players);

    expect(blocks.static).toContain('[CASE_PLAN:');
    expect(blocks.dynamic).toContain('План справи');
    expect(blocks.dynamic).toContain('check_archives: Перевірити міські архіви [активно]');
  });

  // ANT-153: unmet NPCs must still reach the model as a roster, otherwise it
  // never learns the names and never emits [NPC:] tags (registration dead-lock).
  it('lists unmet scenario NPCs as a roster without secrets', () => {
    const blocks = buildSystemPromptBlocks(scenario, makeWorldState(), players);
    expect(blocks.static).toContain('Місіс Гаррієт Ковальська');
    expect(blocks.static).toContain('ще не зустрічали');
    expect(blocks.static).not.toContain('Знає про підвал');
  });

  it('promotes met NPCs to full blocks with secrets', () => {
    const ws = makeWorldState({ npcRelations: { kovalska: 'neutral' } });
    const blocks = buildSystemPromptBlocks(scenario, ws, players);
    expect(blocks.static).toContain('### Місіс Гаррієт Ковальська');
    expect(blocks.static).toContain('Знає про підвал');
    expect(blocks.static).not.toContain('ще не зустрічали');
  });

  it('produces an English ruleset/static when language is en', () => {
    const blocks = buildSystemPromptBlocks(scenario, makeWorldState(), players, { language: 'en' });
    expect(blocks.dynamic.length).toBeGreaterThan(0);
    // Player block label differs by language; the en copy uses Latin-script headings.
    expect(blocks.static).toContain(scenario.systemPrompt);
  });
});
