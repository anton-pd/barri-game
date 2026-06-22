import fs from 'fs';
import path from 'path';
import type { Scenario } from '@/types';

export function isValidScenarioId(scenarioId: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scenarioId);
}

export function getScenariosDir(): string {
  return process.env.SCENARIOS_DIR || path.join(process.cwd(), 'scenarios');
}

export function getScenarioFilePath(scenarioId: string): string {
  if (!isValidScenarioId(scenarioId)) {
    throw new Error('Invalid scenario id format');
  }
  return path.join(getScenariosDir(), `${scenarioId}.json`);
}

export function readScenarioFile(scenarioId: string): Scenario {
  const filePath = getScenarioFilePath(scenarioId);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Scenario;
}

export function writeScenarioFile(scenarioId: string, scenario: Scenario): void {
  const filePath = getScenarioFilePath(scenarioId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2), 'utf-8');
}

export function deleteScenarioFile(scenarioId: string): boolean {
  const filePath = getScenarioFilePath(scenarioId);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function listScenarioFiles(): string[] {
  return fs.readdirSync(getScenariosDir()).filter((file) => file.endsWith('.json'));
}

export function findLocationGroupForLocation(
  scenario: Scenario,
  locationId: string
): { id: string; ambientFile?: string | null } | null {
  const group = scenario.locationGroups?.find((candidate) => candidate.locationIds.includes(locationId));
  return group ? { id: group.id, ambientFile: group.ambientFile ?? null } : null;
}

export function resolveLocationGroupIdForLocation(
  scenario: Scenario,
  locationId: string | null | undefined
): string | null {
  if (!locationId) return null;
  return scenario.locationGroups?.find((candidate) => candidate.locationIds.includes(locationId))?.id ?? null;
}

export function resolveAmbientFileForLocation(
  scenario: Scenario,
  locationId: string | null | undefined
): string | null {
  if (!locationId) return null;

  const group = scenario.locationGroups?.find((candidate) => candidate.locationIds.includes(locationId));
  if (group?.ambientFile) return group.ambientFile;

  return scenario.locations.find((location) => location.id === locationId)?.ambientFile ?? null;
}

export function buildAmbientByLocation(scenario: Scenario): Record<string, string> {
  const ambientByLocation: Record<string, string> = {};

  for (const group of scenario.locationGroups ?? []) {
    if (!group.ambientFile) continue;
    for (const locationId of group.locationIds) {
      ambientByLocation[locationId] = group.ambientFile;
    }
  }

  for (const location of scenario.locations ?? []) {
    if (!ambientByLocation[location.id] && location.ambientFile) {
      ambientByLocation[location.id] = location.ambientFile;
    }
  }

  return ambientByLocation;
}
