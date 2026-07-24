import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookiesMock, verifyJwtMock, getUserByIdMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  verifyJwtMock: vi.fn(),
  getUserByIdMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: verifyJwtMock,
}));

vi.mock('@/lib/queries', () => ({
  getUserById: getUserByIdMock,
}));

import { getCurrentUser, requireAdminUser } from '@/lib/serverAuth';

const adminUser = {
  id: 'user-1',
  email: 'admin@example.com',
  role: 'admin' as const,
  email_verified: true,
  access_status: 'approved' as const,
  created_at: new Date(),
  updated_at: new Date(),
};

function mockCookie(token?: string) {
  cookiesMock.mockResolvedValue({
    get: vi.fn().mockReturnValue(token ? { value: token } : undefined),
  });
}

describe('server authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request without an auth cookie', async () => {
    mockCookie();

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(verifyJwtMock).not.toHaveBeenCalled();
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid JWT', async () => {
    mockCookie('invalid');
    verifyJwtMock.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it('uses the current database role instead of a stale admin JWT claim', async () => {
    mockCookie('stale-admin-token');
    verifyJwtMock.mockResolvedValue({
      sub: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    getUserByIdMock.mockResolvedValue({ ...adminUser, role: 'user' });

    await expect(requireAdminUser()).resolves.toBeNull();
  });

  it('accepts a valid session only when the current database row is admin', async () => {
    mockCookie('valid-token');
    verifyJwtMock.mockResolvedValue({
      sub: 'user-1',
      email: 'admin@example.com',
      role: 'user',
    });
    getUserByIdMock.mockResolvedValue(adminUser);

    await expect(requireAdminUser()).resolves.toEqual(adminUser);
  });

  it('rejects a mismatched database identity', async () => {
    mockCookie('valid-token');
    verifyJwtMock.mockResolvedValue({
      sub: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    getUserByIdMock.mockResolvedValue({ ...adminUser, id: 'user-2' });

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
