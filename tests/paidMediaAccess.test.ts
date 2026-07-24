import { describe, expect, it } from 'vitest';
import {
  evaluateCurrentDbAdminAuthorization,
  evaluatePaidMediaAuthorization,
} from '@/lib/paidMediaAccess';

const approvedUser = {
  id: 'user-1',
  role: 'user' as const,
  access_status: 'approved' as const,
};

describe('paid media authorization', () => {
  it('rejects anonymous requests', () => {
    expect(
      evaluatePaidMediaAuthorization({
        authenticatedUserId: null,
        currentUser: null,
        session: { user_id: 'user-1' },
      }),
    ).toEqual({ ok: false, status: 401, code: 'unauthorized' });
  });

  it('rejects a foreign session', () => {
    expect(
      evaluatePaidMediaAuthorization({
        authenticatedUserId: 'user-1',
        currentUser: approvedUser,
        session: { user_id: 'user-2' },
      }),
    ).toEqual({ ok: false, status: 403, code: 'forbidden' });
  });

  it('rejects legacy ownerless sessions for normal users', () => {
    expect(
      evaluatePaidMediaAuthorization({
        authenticatedUserId: 'user-1',
        currentUser: approvedUser,
        session: { user_id: null },
      }),
    ).toEqual({ ok: false, status: 403, code: 'forbidden' });
  });

  it('uses the current DB approval state', () => {
    expect(
      evaluatePaidMediaAuthorization({
        authenticatedUserId: 'user-1',
        currentUser: { ...approvedUser, access_status: 'blocked' },
        session: { user_id: 'user-1' },
      }),
    ).toEqual({ ok: false, status: 403, code: 'not_approved' });
  });

  it('allows an approved owner', () => {
    expect(
      evaluatePaidMediaAuthorization({
        authenticatedUserId: 'user-1',
        currentUser: approvedUser,
        session: { user_id: 'user-1' },
      }),
    ).toEqual({ ok: true });
  });

  it('allows a current DB admin to maintain a foreign or ownerless session', () => {
    expect(
      evaluatePaidMediaAuthorization({
        authenticatedUserId: 'admin-1',
        currentUser: {
          id: 'admin-1',
          role: 'admin',
          access_status: 'pending',
        },
        session: { user_id: null },
      }),
    ).toEqual({ ok: true });
  });
});

describe('static scenario image materialization authorization', () => {
  it('rejects anonymous and normal users', () => {
    expect(
      evaluateCurrentDbAdminAuthorization({
        authenticatedUserId: null,
        currentUser: null,
      }),
    ).toEqual({ ok: false, status: 401, code: 'unauthorized' });

    expect(
      evaluateCurrentDbAdminAuthorization({
        authenticatedUserId: 'user-1',
        currentUser: approvedUser,
      }),
    ).toEqual({ ok: false, status: 403, code: 'forbidden' });
  });

  it('allows a current DB admin', () => {
    expect(
      evaluateCurrentDbAdminAuthorization({
        authenticatedUserId: 'admin-1',
        currentUser: {
          id: 'admin-1',
          role: 'admin',
          access_status: 'approved',
        },
      }),
    ).toEqual({ ok: true });
  });
});
