import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteScenarioFile,
  getScenarioFilePath,
  getScenariosDir,
  isValidScenarioId,
  listScenarioFiles,
  readScenarioFile,
  writeScenarioFile,
} from '@/lib/scenarioFiles';
import type { Scenario } from '@/types';

const originalScenariosDir = process.env.SCENARIOS_DIR;
const tempRoots: string[] = [];

afterEach(() => {
  if (originalScenariosDir === undefined) {
    delete process.env.SCENARIOS_DIR;
  } else {
    process.env.SCENARIOS_DIR = originalScenariosDir;
  }

  for (const dir of tempRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeScenario(id: string): Scenario {
  return {
    id,
    title: 'Test Scenario',
    titleUk: 'Тестовий сценарій',
    era: '1920s',
    difficulty: 'beginner',
    description: 'A test scenario.',
    systemPrompt: 'Ти — Куратор справи.',
    railguards: [],
    criticalSuccessRules: { investigation: '', combat: '', persuasion: '' },
    mustHappenEvents: [],
    npcs: [],
    locations: [],
  };
}

describe('scenarioFiles', () => {
  it('uses SCENARIOS_DIR as the runtime source of truth when configured', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barri-scenarios-'));
    tempRoots.push(dir);
    process.env.SCENARIOS_DIR = dir;

    writeScenarioFile('shared-case', makeScenario('shared-case'));

    expect(getScenariosDir()).toBe(dir);
    expect(getScenarioFilePath('shared-case')).toBe(path.join(dir, 'shared-case.json'));
    expect(listScenarioFiles()).toEqual(['shared-case.json']);
    expect(readScenarioFile('shared-case').id).toBe('shared-case');
  });

  it('falls back to the repo scenarios directory for local development', () => {
    delete process.env.SCENARIOS_DIR;

    expect(getScenariosDir()).toBe(path.join(process.cwd(), 'scenarios'));
  });

  it('deletes scenario files from the configured scenarios directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barri-scenarios-'));
    tempRoots.push(dir);
    process.env.SCENARIOS_DIR = dir;

    writeScenarioFile('case-to-delete', makeScenario('case-to-delete'));

    expect(deleteScenarioFile('case-to-delete')).toBe(true);
    expect(listScenarioFiles()).toEqual([]);
    expect(deleteScenarioFile('case-to-delete')).toBe(false);
  });

  it('rejects invalid scenario ids before resolving file paths', () => {
    expect(isValidScenarioId('safe-case-1')).toBe(true);
    expect(isValidScenarioId('../unsafe')).toBe(false);
    expect(() => getScenarioFilePath('../unsafe')).toThrow('Invalid scenario id format');
  });
});
