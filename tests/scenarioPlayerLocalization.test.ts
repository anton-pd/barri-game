import { describe, expect, it } from 'vitest';
import { BUILT_IN_ENGLISH_SCENARIO_CONTENT } from '@/lib/scenarioEnglishContent';
import {
  localizePlayersForScenario,
  localizeScenarioForPlayer,
} from '@/lib/scenarioPlayerLocalization';
import { listScenarioFiles, readScenarioFile } from '@/lib/scenarioFiles';

const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/;

describe('scenario player localization', () => {
  it('covers every current live scenario id, including the shared-volume Barcelona case', () => {
    const expectedIds = [
      'barcelona-stones-of-the-unfinished',
      'barrows-dont-sleep',
      'catacombs-of-memory',
      'shadows-over-dnipro',
      'the-black-ledger',
      'the-haunting',
      'the-last-reel',
      'the-last-telegram',
      'whisper-in-the-well',
    ];
    expect(Object.keys(BUILT_IN_ENGLISH_SCENARIO_CONTENT).sort()).toEqual(expectedIds);
  });

  it.each(listScenarioFiles().map((file) => file.replace(/\.json$/, '')))(
    'provides complete English player-facing copy for %s',
    (scenarioId) => {
      const scenario = readScenarioFile(scenarioId);
      const english = localizeScenarioForPlayer(scenario, 'en');

      const playerFacingText = [
        english.description,
        english.briefing?.setting,
        english.briefing?.premise,
        english.briefing?.objective,
        ...(english.locations ?? []).map((location) => location.name),
        ...(english.rolePresets ?? []).flatMap((role) => [
          role.name,
          role.description,
          role.background,
          ...role.inventory.flatMap((item) => [item.name, item.description]),
        ]),
      ].filter((value): value is string => Boolean(value));

      expect(playerFacingText.length).toBeGreaterThan(0);
      for (const text of playerFacingText) {
        expect(text, text).not.toMatch(CYRILLIC);
      }
    },
  );

  it('changes text while preserving role, item, location, skill, and stat mechanics', () => {
    const scenario = readScenarioFile('the-haunting');
    const english = localizeScenarioForPlayer(scenario, 'en');

    expect(english.description).not.toBe(scenario.description);
    expect(english.rolePresets?.map((role) => role.id))
      .toEqual(scenario.rolePresets?.map((role) => role.id));
    expect(english.locations.map((location) => location.id))
      .toEqual(scenario.locations.map((location) => location.id));

    for (const role of english.rolePresets ?? []) {
      const canonical = scenario.rolePresets?.find((candidate) => candidate.id === role.id);
      expect(canonical).toBeDefined();
      expect(role.skills).toEqual(canonical?.skills);
      expect(role.hp).toBe(canonical?.hp);
      expect(role.sanity).toBe(canonical?.sanity);
      expect(role.luck).toBe(canonical?.luck);
      expect(role.inventory.map(({ id, uses }) => ({ id, uses })))
        .toEqual(canonical?.inventory.map(({ id, uses }) => ({ id, uses })));
    }
  });

  it('falls back to canonical content for unknown legacy scenarios', () => {
    const scenario = {
      ...readScenarioFile('the-haunting'),
      id: 'unknown-legacy-scenario',
      localizations: undefined,
    };
    expect(localizeScenarioForPlayer(scenario, 'en')).toBe(scenario);
  });

  it('prefers an embedded scenario localization over the legacy built-in overlay', () => {
    const scenario = readScenarioFile('the-haunting');
    const customized = {
      ...scenario,
      localizations: {
        en: {
          ...scenario.localizations?.en,
          description: 'A custom English description.',
        },
      },
    };

    expect(localizeScenarioForPlayer(customized, 'en').description)
      .toBe('A custom English description.');
  });

  it('localizes an existing English session sheet without changing its state', () => {
    const scenario = readScenarioFile('the-haunting');
    const englishScenario = localizeScenarioForPlayer(scenario, 'en');
    const role = scenario.rolePresets?.[0];
    expect(role).toBeDefined();
    const players = [{
      name: 'Ada',
      role: role!.name,
      roleId: role!.id,
      hp: role!.hp ?? 10,
      maxHp: role!.hp ?? 10,
      sanity: role!.sanity ?? 50,
      maxSanity: role!.sanity ?? 50,
      luck: role!.luck ?? 50,
      maxLuck: role!.luck ?? 50,
      skills: role!.skills,
      inventory: role!.inventory.map((item, index) => ({
        ...item,
        uses: index === 0 ? 0 : item.uses,
        equipped: index === 1,
      })),
      background: role!.background,
    }];

    const [localized] = localizePlayersForScenario(players, englishScenario);
    expect(localized.role).toBe('Private Investigator');
    expect(localized.background).not.toMatch(CYRILLIC);
    expect(localized.inventory[0].name).toBe('Service Revolver');
    expect(localized.inventory[0].uses).toBe(0);
    expect(localized.inventory[1].equipped).toBe(true);
    expect(localized.hp).toBe(players[0].hp);
    expect(localized.skills).toBe(players[0].skills);
  });
});
