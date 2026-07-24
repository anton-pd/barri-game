import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getScenarioMutationAccess } from '@/lib/scenarioMutationGuard';

const productionHost = 'barrigame.es';

describe('shared scenario mutation guard', () => {
  it('fails closed when the enable flag is unset', () => {
    expect(getScenarioMutationAccess(productionHost, {})).toMatchObject({
      allowed: false,
      status: 503,
      code: 'scenario_mutations_disabled',
    });
  });

  it('fails closed when the enable flag is false', () => {
    expect(
      getScenarioMutationAccess(productionHost, {
        SCENARIO_MUTATIONS_ENABLED: 'false',
        SCENARIO_MUTATIONS_ALLOWED_HOST: productionHost,
      })
    ).toMatchObject({ allowed: false, status: 503, code: 'scenario_mutations_disabled' });
  });

  it('permits only an explicitly enabled production host', () => {
    const env = {
      SCENARIO_MUTATIONS_ENABLED: 'true',
      SCENARIO_MUTATIONS_ALLOWED_HOST: productionHost,
    };

    expect(getScenarioMutationAccess(`${productionHost}:443`, env).allowed).toBe(true);
    expect(getScenarioMutationAccess('staging.barrigame.es', env)).toMatchObject({
      allowed: false,
      status: 403,
      code: 'scenario_mutations_forbidden',
    });
  });

  it('keeps every runtime source mutation route behind the guard', () => {
    const saveRoute = readFileSync(
      new URL('../src/app/api/admin/generate-scenario/save/route.ts', import.meta.url),
      'utf8'
    );
    const generateRoute = readFileSync(
      new URL('../src/app/api/admin/generate-scenario/route.ts', import.meta.url),
      'utf8'
    );
    const deleteRoute = readFileSync(
      new URL('../src/app/api/admin/scenarios/[id]/route.ts', import.meta.url),
      'utf8'
    );
    const ambientRoute = readFileSync(
      new URL('../src/app/api/scenarios/[id]/ambient/route.ts', import.meta.url),
      'utf8'
    );

    expect(saveRoute).toContain('getScenarioMutationAccess');
    expect(generateRoute).toContain('getScenarioMutationAccess');
    expect(deleteRoute).toContain('getScenarioMutationAccess');
    expect(ambientRoute).toContain('persistScenario: false');
  });
});
