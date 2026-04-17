import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyJwt } from '@/lib/auth';
import { getAllUsers, getAllSessionsWithOwner } from '@/lib/queries';
import AdminTabs from './AdminTabs';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;
  if (!payload) redirect('/auth/login');

  const [users, sessions] = await Promise.all([
    getAllUsers(),
    getAllSessionsWithOwner(),
  ]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200">
      <div className="border-b border-stone-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-amber-500 text-lg tracking-widest uppercase">Keeper&apos;s Archive</h1>
          <p className="text-stone-500 text-xs mt-0.5">Admin Panel</p>
        </div>
        <Link href="/" className="text-stone-400 hover:text-stone-200 text-sm transition-colors">
          ← Back to Sessions
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <AdminTabs
          users={users as {
            id: string; email: string; role: string;
            email_verified: boolean; session_count: number; created_at: string;
          }[]}
        sessions={sessions as {
          id: string; name: string; scenario_id: string;
          owner_email?: string;
          act: number;
          status: string;
          updated_at: string;
          completed_at?: string | null;
          feedback_rating?: number | null;
          feedback_comment?: string | null;
        }[]}
        currentUserId={payload.sub}
      />
      </div>
    </div>
  );
}
