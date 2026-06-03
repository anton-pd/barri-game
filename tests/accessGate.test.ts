import { describe, it, expect } from 'vitest';
import { evaluateAccessGate, type AccessGateInputs } from '@/lib/accessGate';

function inputs(overrides: Partial<AccessGateInputs> = {}): AccessGateInputs {
  return {
    role: 'user',
    accessStatus: 'approved',
    enforceDailyCap: true,
    dailyLimitEnabled: true,
    dailyLimitUsd: 0.5,
    spentTodayUsd: 0,
    ...overrides,
  };
}

describe('evaluateAccessGate — waiting list', () => {
  it('blocks pending users with 403 not_approved', () => {
    const r = evaluateAccessGate(inputs({ accessStatus: 'pending' }));
    expect(r).toMatchObject({ ok: false, code: 'not_approved', status: 403 });
  });

  it('blocks blocked users with 403 not_approved', () => {
    const r = evaluateAccessGate(inputs({ accessStatus: 'blocked' }));
    expect(r).toMatchObject({ ok: false, code: 'not_approved', status: 403 });
  });

  it('allows approved users under the cap', () => {
    expect(evaluateAccessGate(inputs())).toEqual({ ok: true });
  });
});

describe('evaluateAccessGate — admin bypass', () => {
  it('admins bypass approval even when pending', () => {
    expect(evaluateAccessGate(inputs({ role: 'admin', accessStatus: 'pending' }))).toEqual({ ok: true });
  });

  it('admins bypass the daily cap even when over budget', () => {
    expect(
      evaluateAccessGate(inputs({ role: 'admin', accessStatus: 'approved', spentTodayUsd: 99 }))
    ).toEqual({ ok: true });
  });
});

describe('evaluateAccessGate — daily cost cap', () => {
  it('blocks at exactly the limit (>= boundary)', () => {
    const r = evaluateAccessGate(inputs({ spentTodayUsd: 0.5, dailyLimitUsd: 0.5 }));
    expect(r).toMatchObject({ ok: false, code: 'daily_limit_reached', status: 429 });
  });

  it('blocks over the limit', () => {
    const r = evaluateAccessGate(inputs({ spentTodayUsd: 0.51 }));
    expect(r).toMatchObject({ ok: false, code: 'daily_limit_reached', status: 429 });
  });

  it('allows just under the limit', () => {
    expect(evaluateAccessGate(inputs({ spentTodayUsd: 0.49 }))).toEqual({ ok: true });
  });

  it('skips the cap when enforceDailyCap is false (e.g. session creation)', () => {
    expect(
      evaluateAccessGate(inputs({ enforceDailyCap: false, spentTodayUsd: 99 }))
    ).toEqual({ ok: true });
  });

  it('skips the cap when the limit is disabled globally', () => {
    expect(
      evaluateAccessGate(inputs({ dailyLimitEnabled: false, spentTodayUsd: 99 }))
    ).toEqual({ ok: true });
  });

  it('treats a zero/negative limit as disabled', () => {
    expect(evaluateAccessGate(inputs({ dailyLimitUsd: 0, spentTodayUsd: 99 }))).toEqual({ ok: true });
  });

  it('approval is checked before the cap (pending + over budget → not_approved)', () => {
    const r = evaluateAccessGate(inputs({ accessStatus: 'pending', spentTodayUsd: 99 }));
    expect(r).toMatchObject({ ok: false, code: 'not_approved' });
  });
});
