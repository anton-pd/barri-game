import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJwt } from '@/lib/auth';
import SessionList from '@/components/SessionList';

export default async function SessionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;

  if (!payload) {
    redirect('/auth/login');
  }

  return <SessionList />;
}
