import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock the `sql` client (default export of @/lib/db) with a tagged-template
// spy so we can assert WHAT erasure runs without a real database. This is the
// regression guard for the GDPR Art. 17 FK trap (ANT-159): game_sessions.user_id
// is ON DELETE SET NULL, so deletion MUST remove sessions explicitly (cascading
// messages) before deleting the user — a single `DELETE FROM users` would orphan
// the chat content instead of erasing it.

const calls: { sql: string; values: unknown[] }[] = [];
let beganTransaction = false;

function tag(strings: TemplateStringsArray | string[], ...values: unknown[]): Promise<unknown[]> {
  const text = Array.isArray(strings) ? strings.join('?') : String(strings);
  calls.push({ sql: text, values });
  if (text.includes('FROM users')) {
    return Promise.resolve([
      { id: 'u1', email: 'a@b.com', role: 'user', email_verified: true, access_status: 'approved' },
    ]);
  }
  if (text.includes('FROM game_sessions')) {
    return Promise.resolve([{ id: 's1' }, { id: 's2' }]);
  }
  if (text.includes('FROM messages')) {
    return Promise.resolve([
      { session_id: 's1', content: 'hi' },
      { session_id: 's2', content: 'there' },
    ]);
  }
  return Promise.resolve([]);
}

vi.mock('@/lib/db', () => ({
  default: Object.assign(tag, {
    begin: async (cb: (tx: typeof tag) => Promise<unknown>) => {
      beganTransaction = true;
      return cb(tag);
    },
  }),
}));

import { deleteUserAccount, getUserAccountExport, updateUserInterfaceLanguage } from '@/lib/queries';

beforeEach(() => {
  calls.length = 0;
  beganTransaction = false;
});

describe('deleteUserAccount (ANT-159, GDPR Art. 17)', () => {
  it('deletes sessions and waitlist explicitly, inside a transaction, before the user row', async () => {
    await deleteUserAccount('u1', 'A@B.com');

    expect(beganTransaction).toBe(true);

    const targets = calls.map((c) => c.sql);
    const sessionIdx = targets.findIndex((s) => s.includes('DELETE FROM game_sessions'));
    const waitlistIdx = targets.findIndex((s) => s.includes('DELETE FROM waitlist_entries'));
    const userIdx = targets.findIndex((s) => s.includes('DELETE FROM users'));

    // All three deletions happen…
    expect(sessionIdx).toBeGreaterThanOrEqual(0);
    expect(waitlistIdx).toBeGreaterThanOrEqual(0);
    expect(userIdx).toBeGreaterThanOrEqual(0);

    // …and the user row is deleted LAST (otherwise SET NULL orphans the sessions).
    expect(userIdx).toBeGreaterThan(sessionIdx);
    expect(userIdx).toBeGreaterThan(waitlistIdx);
  });

  it('matches the waitlist row by lower-cased email', async () => {
    await deleteUserAccount('u1', 'Mixed@Case.COM');
    const waitlistCall = calls.find((c) => c.sql.includes('DELETE FROM waitlist_entries'));
    expect(waitlistCall?.values).toContain('mixed@case.com');
  });
});

describe('getUserAccountExport (ANT-159, GDPR Art. 20)', () => {
  it('never includes password_hash or auth tokens', async () => {
    const result = await getUserAccountExport('u1');
    expect(result).not.toBeNull();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('password_hash');
    expect(serialized).not.toContain('verify_token');
    expect(serialized).not.toContain('reset_token');
  });

  it('groups messages under their owning sessions', async () => {
    const result = await getUserAccountExport('u1');
    expect(result?.sessions).toHaveLength(2);
    const s1 = result?.sessions.find((s) => s.id === 's1');
    expect(s1?.messages).toHaveLength(1);
    expect(s1?.messages[0].content).toBe('hi');
  });
});

describe('updateUserInterfaceLanguage', () => {
  it('persists the selected account interface language', async () => {
    await updateUserInterfaceLanguage('u1', 'es');

    const updateCall = calls.find((c) => c.sql.includes('UPDATE users') && c.sql.includes('interface_language'));
    expect(updateCall).toBeTruthy();
    expect(updateCall?.values).toContain('es');
    expect(updateCall?.values).toContain('u1');
  });
});
