// Access gating for the public release (ANT-108): waiting-list approval +
// per-user daily cost cap. This module is PURE (no DB / no server deps) so the
// decision logic is unit-testable on the ANT-107 harness. Routes fetch the
// inputs from the DB and call `evaluateAccessGate`.

import type { AccessStatus } from '@/types';

export type GateCode = 'not_approved' | 'daily_limit_reached';

export type GateResult =
  | { ok: true }
  | { ok: false; code: GateCode; status: number; message: string };

export interface AccessGateInputs {
  role: 'user' | 'admin';
  accessStatus: AccessStatus;
  /** Whether to also enforce the daily cost cap (false for cost-free actions). */
  enforceDailyCap: boolean;
  dailyLimitEnabled: boolean;
  /** Per-user daily cap in USD. <= 0 disables the cap. */
  dailyLimitUsd: number;
  /** User's API spend so far today, in USD. */
  spentTodayUsd: number;
}

// User-facing copy is Ukrainian (app default language).
const MSG_NOT_APPROVED =
  'Ваш акаунт у списку очікування. Ми відкриваємо доступ поступово — повідомимо, щойно ваша черга підійде.';
const MSG_DAILY_LIMIT =
  'Денний ліміт вичерпано. Повертайтесь завтра, щоб продовжити розслідування.';

export function evaluateAccessGate(inputs: AccessGateInputs): GateResult {
  // Admins bypass every gate.
  if (inputs.role === 'admin') return { ok: true };

  if (inputs.accessStatus !== 'approved') {
    return { ok: false, code: 'not_approved', status: 403, message: MSG_NOT_APPROVED };
  }

  if (
    inputs.enforceDailyCap &&
    inputs.dailyLimitEnabled &&
    inputs.dailyLimitUsd > 0 &&
    inputs.spentTodayUsd >= inputs.dailyLimitUsd
  ) {
    return { ok: false, code: 'daily_limit_reached', status: 429, message: MSG_DAILY_LIMIT };
  }

  return { ok: true };
}
