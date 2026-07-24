import type {
  InventoryItem,
  Player,
  RolePreset,
  Scenario,
  ScenarioPlayerLocalization,
} from '@/types';
import { BUILT_IN_ENGLISH_SCENARIO_CONTENT } from '@/lib/scenarioEnglishContent';

export type ScenarioPlayerLanguage = 'uk' | 'en';

export function getScenarioPlayerLocalization(
  scenario: Pick<Scenario, 'id' | 'localizations'>,
  language: ScenarioPlayerLanguage,
): ScenarioPlayerLocalization | undefined {
  if (language === 'uk') return undefined;
  return scenario.localizations?.en ?? BUILT_IN_ENGLISH_SCENARIO_CONTENT[scenario.id];
}

export function localizeScenarioForPlayer(
  scenario: Scenario,
  language: ScenarioPlayerLanguage,
): Scenario {
  const localization = getScenarioPlayerLocalization(scenario, language);
  if (!localization) return scenario;

  const localizedRoles = localization.rolePresets
    ? mergeRolePresets(scenario.rolePresets ?? [], localization.rolePresets)
    : scenario.rolePresets;
  const localizedLocations = localization.locations
    ? scenario.locations.map((location) => {
        const translated = localization.locations?.find((item) => item.id === location.id);
        return translated ? { ...location, name: translated.name } : location;
      })
    : scenario.locations;

  return {
    ...scenario,
    description: localization.description,
    ...(localization.briefing ? { briefing: localization.briefing } : {}),
    ...(localizedRoles ? { rolePresets: localizedRoles } : {}),
    locations: localizedLocations,
  };
}

export function localizePlayersForScenario(
  players: Player[],
  localizedScenario: Pick<Scenario, 'rolePresets'>,
): Player[] {
  return players.map((player) => {
    const role = localizedScenario.rolePresets?.find(
      (candidate) => candidate.id === player.roleId,
    );
    if (!role) return player;

    return {
      ...player,
      role: role.name,
      background: role.background,
      inventory: player.inventory.map((item) => {
        const localizedItem = role.inventory.find((candidate) => candidate.id === item.id);
        return localizedItem
          ? { ...item, name: localizedItem.name, description: localizedItem.description }
          : item;
      }),
    };
  });
}

function mergeRolePresets(
  roles: RolePreset[],
  localizedRoles: NonNullable<ScenarioPlayerLocalization['rolePresets']>,
): RolePreset[] {
  return roles.map((role) => {
    const translated = localizedRoles.find((item) => item.id === role.id);
    if (!translated) return role;

    return {
      ...role,
      name: translated.name,
      description: translated.description,
      background: translated.background,
      inventory: mergeInventory(role.inventory, translated.inventory),
    };
  });
}

function mergeInventory(
  inventory: InventoryItem[],
  localizedInventory: NonNullable<
    ScenarioPlayerLocalization['rolePresets']
  >[number]['inventory'],
): InventoryItem[] {
  return inventory.map((item) => {
    const translated = localizedInventory.find((candidate) => candidate.id === item.id);
    return translated
      ? { ...item, name: translated.name, description: translated.description }
      : item;
  });
}
