import type { InventoryItem, RolePreset, Scenario, StatEntry } from '@/types';
import {
  getScenarioPlayerLocalization,
  localizeScenarioForPlayer,
} from '@/lib/scenarioPlayerLocalization';

export interface CatalogRolePreset {
  id: string;
  name: string;
  description: string;
  rulesetId?: string;
  scenarioId?: string;
  hp?: number;
  sanity?: number;
  luck?: number;
  stats?: Record<string, StatEntry>;
  skills: Record<string, number>;
  inventory: InventoryItem[];
  background: string;
}

export interface ScenarioCatalogEntry {
  id: string;
  title: string;
  titleUk: string;
  era: string;
  difficulty: Scenario['difficulty'];
  description: string;
  cover?: string;
  rulesetId?: string;
  supportedRoles?: string[];
  defaultRoles?: string[];
  sessionConfig?: Scenario['sessionConfig'];
  rolePresets?: CatalogRolePreset[];
  locations: { id: string; name: string }[];
  localizations?: {
    en?: ScenarioCatalogLocalization;
  };
}

export interface ScenarioCatalogLocalization {
  description: string;
  rolePresets?: CatalogRolePreset[];
  locations: { id: string; name: string }[];
}

export function canViewStaticScenarioGallery(
  role: 'user' | 'admin' | null | undefined,
): boolean {
  return role === 'admin';
}

export function toScenarioCatalogEntry(
  scenario: Scenario,
  cover?: string,
): ScenarioCatalogEntry {
  const entry: ScenarioCatalogEntry = {
    id: scenario.id,
    title: scenario.title,
    titleUk: scenario.titleUk,
    era: scenario.era,
    difficulty: scenario.difficulty,
    description: scenario.description,
    ...(cover ? { cover } : {}),
    ...(scenario.rulesetId ? { rulesetId: scenario.rulesetId } : {}),
    ...(scenario.supportedRoles ? { supportedRoles: scenario.supportedRoles } : {}),
    ...(scenario.defaultRoles ? { defaultRoles: scenario.defaultRoles } : {}),
    ...(scenario.sessionConfig ? {
      sessionConfig: {
        minPlayers: scenario.sessionConfig.minPlayers,
        maxPlayers: scenario.sessionConfig.maxPlayers,
        estimatedSessions: scenario.sessionConfig.estimatedSessions,
        isCampaign: scenario.sessionConfig.isCampaign,
        ...(scenario.sessionConfig.defaultKeeperStyle
          ? { defaultKeeperStyle: scenario.sessionConfig.defaultKeeperStyle }
          : {}),
      },
    } : {}),
    ...(scenario.rolePresets ? {
      rolePresets: scenario.rolePresets.map(toCatalogRolePreset),
    } : {}),
    locations: (scenario.locations ?? []).map(({ id, name }) => ({ id, name })),
  };

  if (getScenarioPlayerLocalization(scenario, 'en')) {
    const englishScenario = localizeScenarioForPlayer(scenario, 'en');
    entry.localizations = {
      en: {
        description: englishScenario.description,
        ...(englishScenario.rolePresets ? {
          rolePresets: englishScenario.rolePresets.map(toCatalogRolePreset),
        } : {}),
        locations: (englishScenario.locations ?? []).map(({ id, name }) => ({ id, name })),
      },
    };
  }

  return entry;
}

function toCatalogRolePreset(role: RolePreset): CatalogRolePreset {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    ...(role.rulesetId ? { rulesetId: role.rulesetId } : {}),
    ...(role.scenarioId ? { scenarioId: role.scenarioId } : {}),
    ...(role.hp !== undefined ? { hp: role.hp } : {}),
    ...(role.sanity !== undefined ? { sanity: role.sanity } : {}),
    ...(role.luck !== undefined ? { luck: role.luck } : {}),
    ...(role.stats ? { stats: role.stats } : {}),
    skills: { ...role.skills },
    inventory: role.inventory.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      uses: item.uses,
      ...(item.equipped !== undefined ? { equipped: item.equipped } : {}),
      ...(item.broken !== undefined ? { broken: item.broken } : {}),
    })),
    background: role.background,
  };
}
