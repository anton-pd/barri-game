import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyJwt } from '@/lib/auth';
import { getAllUsers, getAllSessionsWithOwner } from '@/lib/queries';
import RoleToggle from './RoleToggle';
import CostsTables from './CostsTables';
import KeeperSettings from './KeeperSettings';
import ScenarioGenerator from './ScenarioGenerator';

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
      {/* Header */}
      <div className="border-b border-stone-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-amber-500 text-lg tracking-widest uppercase">Keeper&apos;s Archive</h1>
          <p className="text-stone-500 text-xs mt-0.5">Admin Panel</p>
        </div>
        <Link href="/" className="text-stone-400 hover:text-stone-200 text-sm transition-colors">
          ← Back to Sessions
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">

        {/* Users Section */}
        <section>
          <h2 className="text-stone-300 text-sm tracking-widest uppercase mb-4">
            Investigators ({users.length})
          </h2>
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Verified</th>
                  <th className="text-left px-4 py-3">Sessions</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                    <td className="px-4 py-3 text-stone-200">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        user.role === 'admin'
                          ? 'bg-amber-900/50 text-amber-400'
                          : 'bg-stone-800 text-stone-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.email_verified
                        ? <span className="text-emerald-500 text-xs">✓ verified</span>
                        : <span className="text-stone-600 text-xs">✗ pending</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-stone-400">{user.session_count}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {user.id !== payload.sub && (
                        <RoleToggle userId={user.id} currentRole={user.role} />
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-stone-600">
                      No investigators registered yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Keeper Settings — global model & TTS config */}
        <KeeperSettings />

        {/* Scenario Generator — AI-powered scenario creation */}
        <ScenarioGenerator />

        {/* API Costs — live client component, auto-refreshes every 30s */}
        <CostsTables />

        {/* Sessions Section */}
        <section>
          <h2 className="text-stone-300 text-sm tracking-widest uppercase mb-4">
            All Sessions ({sessions.length})
          </h2>
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Scenario</th>
                  <th className="text-left px-4 py-3">Owner</th>
                  <th className="text-left px-4 py-3">Act</th>
                  <th className="text-left px-4 py-3">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                    <td className="px-4 py-3 text-stone-200">{session.name}</td>
                    <td className="px-4 py-3 text-stone-400 text-xs">{session.scenario_id}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {session.owner_email ?? <span className="text-stone-700">anonymous</span>}
                    </td>
                    <td className="px-4 py-3 text-stone-400">{session.act}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {new Date(session.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/session/${session.id}`}
                        className="text-amber-600 hover:text-amber-500 text-xs transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-stone-600">
                      No active sessions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
