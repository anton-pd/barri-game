import { evaluateAccessGate } from '@/lib/accessGate';
import { getSessionFromCookieHeader } from '@/lib/auth';
import {
  getAllAppSettings,
  getSession,
  getUserById,
  getUserDailyCost,
} from '@/lib/queries';
import type { AccessStatus, User } from '@/types';

type CurrentUser = Pick<User, 'id' | 'role' | 'access_status'>;

export type AdminAccessDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403; code: 'unauthorized' | 'forbidden' };

export function evaluateCurrentDbAdminAuthorization(input: {
  authenticatedUserId: string | null;
  currentUser: CurrentUser | null;
}): AdminAccessDecision {
  const { authenticatedUserId, currentUser } = input;
  if (!authenticatedUserId || !currentUser || currentUser.id !== authenticatedUserId) {
    return { ok: false, status: 401, code: 'unauthorized' };
  }
  if (currentUser.role !== 'admin') {
    return { ok: false, status: 403, code: 'forbidden' };
  }
  return { ok: true };
}

export type PaidMediaAccessDecision =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403 | 404;
      code: 'unauthorized' | 'not_approved' | 'session_not_found' | 'forbidden';
    };

export function evaluatePaidMediaAuthorization(input: {
  authenticatedUserId: string | null;
  currentUser: CurrentUser | null;
  session: { user_id: string | null } | null;
}): PaidMediaAccessDecision {
  const { authenticatedUserId, currentUser, session } = input;

  if (!authenticatedUserId || !currentUser || currentUser.id !== authenticatedUserId) {
    return { ok: false, status: 401, code: 'unauthorized' };
  }

  if (currentUser.role !== 'admin' && currentUser.access_status !== 'approved') {
    return { ok: false, status: 403, code: 'not_approved' };
  }

  if (!session) {
    return { ok: false, status: 404, code: 'session_not_found' };
  }

  // Paid operations require provable ownership. Legacy ownerless sessions are
  // intentionally denied to normal users; an admin can still maintain them.
  if (currentUser.role !== 'admin' && session.user_id !== currentUser.id) {
    return { ok: false, status: 403, code: 'forbidden' };
  }

  return { ok: true };
}

function errorResponse(
  status: number,
  code: string,
  message?: string,
): Response {
  return Response.json(
    { error: code, ...(message ? { message } : {}) },
    { status },
  );
}

async function getAuthenticatedDbUser(request: Request): Promise<{
  authenticatedUserId: string | null;
  currentUser: User | null;
}> {
  const payload = await getSessionFromCookieHeader(request.headers.get('cookie'));
  if (!payload) return { authenticatedUserId: null, currentUser: null };

  const currentUser = await getUserById(payload.sub);
  return { authenticatedUserId: payload.sub, currentUser };
}

export type PaidSessionAccessResult =
  | { ok: true; user: User }
  | { ok: false; response: Response };

export async function requirePaidSessionAccess(
  request: Request,
  sessionId: string,
): Promise<PaidSessionAccessResult> {
  const { authenticatedUserId, currentUser } = await getAuthenticatedDbUser(request);

  if (!authenticatedUserId || !currentUser) {
    return { ok: false, response: errorResponse(401, 'unauthorized') };
  }

  if (currentUser.role !== 'admin' && currentUser.access_status !== 'approved') {
    return { ok: false, response: errorResponse(403, 'not_approved') };
  }

  const [session, settings, spentTodayUsd] = await Promise.all([
    getSession(sessionId),
    getAllAppSettings(),
    getUserDailyCost(currentUser.id),
  ]);

  const authorization = evaluatePaidMediaAuthorization({
    authenticatedUserId,
    currentUser,
    session,
  });
  if (!authorization.ok) {
    return {
      ok: false,
      response: errorResponse(authorization.status, authorization.code),
    };
  }

  const gate = evaluateAccessGate({
    role: currentUser.role,
    accessStatus: currentUser.access_status as AccessStatus,
    enforceDailyCap: true,
    dailyLimitEnabled: settings.daily_limit_enabled === 'true',
    dailyLimitUsd: Number.parseFloat(settings.daily_user_cost_limit_usd ?? '0'),
    spentTodayUsd,
  });
  if (!gate.ok) {
    return {
      ok: false,
      response: errorResponse(gate.status, gate.code, gate.message),
    };
  }

  return { ok: true, user: currentUser };
}

export async function requireCurrentDbAdmin(
  request: Request,
): Promise<PaidSessionAccessResult> {
  const { authenticatedUserId, currentUser } = await getAuthenticatedDbUser(request);
  const authorization = evaluateCurrentDbAdminAuthorization({
    authenticatedUserId,
    currentUser,
  });
  if (!authorization.ok) {
    return {
      ok: false,
      response: errorResponse(authorization.status, authorization.code),
    };
  }
  if (!currentUser) {
    return { ok: false, response: errorResponse(401, 'unauthorized') };
  }
  return { ok: true, user: currentUser };
}
