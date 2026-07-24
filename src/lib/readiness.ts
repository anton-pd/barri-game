export type ReadinessState = 'ok' | 'failed';

export type ReadinessResult = {
  status: 'ok' | 'unavailable';
  checks: {
    database: ReadinessState;
    scenarios: ReadinessState;
  };
};

type ReadinessChecks = {
  database: () => Promise<void>;
  scenarios: () => Promise<void>;
};

async function runCheck(check: () => Promise<void>): Promise<ReadinessState> {
  try {
    await check();
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** Returns only dependency state; never exposes connection strings or errors. */
export async function evaluateReadiness(checks: ReadinessChecks): Promise<ReadinessResult> {
  const [database, scenarios] = await Promise.all([
    runCheck(checks.database),
    runCheck(checks.scenarios),
  ]);

  return {
    status: database === 'ok' && scenarios === 'ok' ? 'ok' : 'unavailable',
    checks: { database, scenarios },
  };
}
