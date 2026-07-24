import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateSessionAccess } from '@/lib/sessionAccess';
import {
  clearAllSessionCaches,
  loadUserSessionCache,
  writeUserSessionCache,
} from '@/lib/sessionCache';

const owner = { id: 'owner-1', role: 'user' as const };
const admin = { id: 'admin-1', role: 'admin' as const };

describe('session ownership isolation', () => {
  it('allows the exact current database owner', () => {
    expect(evaluateSessionAccess({
      authenticatedUserId: owner.id,
      currentUser: owner,
      session: { user_id: owner.id },
    })).toEqual({ ok: true });
  });

  it('rejects a non-owner and ownerless legacy session for a normal user', () => {
    expect(evaluateSessionAccess({
      authenticatedUserId: owner.id,
      currentUser: owner,
      session: { user_id: 'other-user' },
    })).toEqual({ ok: false, status: 403, code: 'forbidden' });
    expect(evaluateSessionAccess({
      authenticatedUserId: owner.id,
      currentUser: owner,
      session: { user_id: null },
    })).toEqual({ ok: false, status: 403, code: 'forbidden' });
  });

  it('allows a current database admin to provide intentional support access', () => {
    expect(evaluateSessionAccess({
      authenticatedUserId: admin.id,
      currentUser: admin,
      session: { user_id: 'other-user' },
    })).toEqual({ ok: true });
    expect(evaluateSessionAccess({
      authenticatedUserId: admin.id,
      currentUser: admin,
      session: { user_id: null },
    })).toEqual({ ok: true });
  });
});

function makeStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => { entries.delete(key); },
    setItem: (key, value) => { entries.set(key, value); },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('browser session cache isolation', () => {
  it('uses a separate key for each verified user identity', () => {
    vi.stubGlobal('window', { sessionStorage: makeStorage() });

    writeUserSessionCache('alice', [{ id: 'alice-session' }]);
    writeUserSessionCache('bob', [{ id: 'bob-session' }]);

    expect(loadUserSessionCache<{ id: string }>('alice')).toEqual([{ id: 'alice-session' }]);
    expect(loadUserSessionCache<{ id: string }>('bob')).toEqual([{ id: 'bob-session' }]);
  });

  it('clears every session snapshot key, including the old shared key, on identity transition', () => {
    const storage = makeStorage();
    vi.stubGlobal('window', { sessionStorage: storage });
    storage.setItem('barri.readOnlySessions', JSON.stringify([{ id: 'legacy' }]));
    writeUserSessionCache('alice', [{ id: 'alice-session' }]);
    writeUserSessionCache('bob', [{ id: 'bob-session' }]);

    clearAllSessionCaches();

    expect(storage.length).toBe(0);
  });
});
