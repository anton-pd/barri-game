import { describe, expect, it } from 'vitest';
import {
  canViewStaticScenarioGallery,
  toScenarioCatalogEntry,
} from '@/lib/scenarioCatalog';
import { readScenarioFile } from '@/lib/scenarioFiles';

function collectKeys(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, result);
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      result.add(key);
      collectKeys(nested, result);
    }
  }
  return result;
}

describe('scenario catalog DTO', () => {
  const scenario = readScenarioFile('the-haunting');
  const dto = toScenarioCatalogEntry(scenario, '/scenarios/the-haunting/cover.jpg');
  const serialized = JSON.stringify(dto);

  it('uses an explicit player-facing top-level allowlist', () => {
    expect(Object.keys(dto).sort()).toEqual([
      'cover', 'defaultRoles', 'description', 'difficulty', 'era', 'id',
      'localizations', 'locations', 'rolePresets', 'rulesetId', 'sessionConfig',
      'supportedRoles', 'title', 'titleUk',
    ]);
  });

  it('never serializes keeper-only keys', () => {
    const forbidden = [
      'systemPrompt', 'railguards', 'criticalSuccessRules', 'mustHappenEvents',
      'npcs', 'secrets', 'clues', 'staticImages', 'prompt', 'locationGroups',
      'variants', 'introHint', 'eventHints', 'generatedBy', 'briefing',
    ];
    const keys = collectKeys(dto);
    for (const key of forbidden) expect(keys.has(key), key).toBe(false);
  });

  it('never serializes representative secret values', () => {
    const secretValues = [
      scenario.systemPrompt,
      scenario.mustHappenEvents[0],
      scenario.npcs[0]?.secrets[0],
      scenario.locations[0]?.clues[0],
      scenario.variants?.[0]?.introHint,
      scenario.eventHints?.negative[0],
    ].filter((value): value is string => Boolean(value));

    for (const secret of secretValues) expect(serialized).not.toContain(secret);
  });

  it('keeps only location identity needed by session cards', () => {
    expect(dto.locations[0]).toEqual({
      id: scenario.locations[0].id,
      name: scenario.locations[0].name,
    });
  });

  it('includes a safe English player-facing overlay', () => {
    expect(dto.localizations?.en?.description).toContain('Boston');
    expect(dto.localizations?.en?.rolePresets?.[0].name).toBe('Private Investigator');
    expect(dto.localizations?.en?.locations[0]).toEqual({
      id: scenario.locations[0].id,
      name: "Investigators' Office",
    });
  });
});

describe('static gallery beta visibility', () => {
  it('fails closed for anonymous and normal players', () => {
    expect(canViewStaticScenarioGallery(null)).toBe(false);
    expect(canViewStaticScenarioGallery('user')).toBe(false);
  });

  it('allows admins while dynamic session images remain a separate flow', () => {
    expect(canViewStaticScenarioGallery('admin')).toBe(true);
  });
});
