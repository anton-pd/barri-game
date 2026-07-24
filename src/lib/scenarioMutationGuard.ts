const MUTATION_PERMIT = Symbol('scenarioMutationPermit');

type ScenarioMutationEnv = Partial<Pick<
  NodeJS.ProcessEnv,
  'SCENARIO_MUTATIONS_ENABLED' | 'SCENARIO_MUTATIONS_ALLOWED_HOST'
>>;

export type ScenarioMutationPermit = {
  readonly [MUTATION_PERMIT]: true;
};

export type ScenarioMutationAccess =
  | { allowed: true; permit: ScenarioMutationPermit }
  | {
      allowed: false;
      status: 403 | 503;
      code: 'scenario_mutations_disabled' | 'scenario_mutations_forbidden';
    };

function normalizeHost(host: string | null | undefined): string {
  return host?.trim().toLowerCase().replace(/:\d+$/, '') ?? '';
}

/**
 * Scenario JSON is shared between staging and production. Mutations are off by
 * default and need both an explicit enable and an exact request-host allowlist.
 */
export function getScenarioMutationAccess(
  requestHost: string | null,
  env: ScenarioMutationEnv = process.env as ScenarioMutationEnv
): ScenarioMutationAccess {
  const allowedHost = normalizeHost(env.SCENARIO_MUTATIONS_ALLOWED_HOST);
  if (env.SCENARIO_MUTATIONS_ENABLED !== 'true' || !allowedHost) {
    return { allowed: false, status: 503, code: 'scenario_mutations_disabled' };
  }

  if (normalizeHost(requestHost) !== allowedHost) {
    return { allowed: false, status: 403, code: 'scenario_mutations_forbidden' };
  }

  return { allowed: true, permit: { [MUTATION_PERMIT]: true } };
}

export function assertScenarioMutationPermit(
  permit: ScenarioMutationPermit | undefined
): asserts permit is ScenarioMutationPermit {
  if (!permit || permit[MUTATION_PERMIT] !== true) {
    throw new Error('Scenario source mutations require an explicit permit');
  }
}

export function requireScenarioMutationPermit(
  permit: ScenarioMutationPermit | undefined
): ScenarioMutationPermit {
  assertScenarioMutationPermit(permit);
  return permit;
}
