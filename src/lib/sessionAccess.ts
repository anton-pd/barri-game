import type { User } from '@/types';

type CurrentUser = Pick<User, 'id' | 'role'>;

export type SessionAccessDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403; code: 'unauthorized' | 'forbidden' };

/** Session data belongs only to its current database owner or a current admin. */
export function evaluateSessionAccess(input: {
  authenticatedUserId: string | null;
  currentUser: CurrentUser | null;
  session: { user_id: string | null } | null;
}): SessionAccessDecision {
  const { authenticatedUserId, currentUser, session } = input;
  if (!authenticatedUserId || !currentUser || currentUser.id !== authenticatedUserId) {
    return { ok: false, status: 401, code: 'unauthorized' };
  }
  // Ownerless rows are never a legacy public fallback.
  if (!session || (currentUser.role !== 'admin' && session.user_id !== currentUser.id)) {
    return { ok: false, status: 403, code: 'forbidden' };
  }
  return { ok: true };
}
