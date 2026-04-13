import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJwt } from '@/lib/auth';
import { getUserById } from '@/lib/queries';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;

  if (!payload) redirect('/auth/login');

  // Check DB role — handles the case where role was updated after JWT was issued
  const user = await getUserById(payload.sub);
  if (!user || user.role !== 'admin') redirect('/');

  return <>{children}</>;
}
