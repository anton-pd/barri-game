import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { getUserById } from '@/lib/queries';
import type { User } from '@/types';

/**
 * Resolve the signed-in user against the database.
 *
 * JWT claims prove the session, but mutable authorization fields such as role
 * and access status must always come from the current database row.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;

  const payload = await verifyJwt(token);
  if (!payload?.sub) return null;

  const user = await getUserById(payload.sub);
  return user?.id === payload.sub ? user : null;
}

export async function requireAdminUser(): Promise<User | null> {
  const user = await getCurrentUser();
  return user?.role === 'admin' ? user : null;
}
