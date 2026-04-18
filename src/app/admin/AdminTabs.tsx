'use client';

import { useState } from 'react';
import Link from 'next/link';
import RoleToggle from './RoleToggle';
import KeeperSettings from './KeeperSettings';
import ScenarioGenerator from './ScenarioGenerator';
import ScenarioStats from './ScenarioStats';
import UsageTab from './UsageTab';
import PricingEditor from './PricingEditor';

type Tab = 'users' | 'usage' | 'scenarios' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'users',     label: 'Users' },
  { id: 'usage',     label: 'Usage' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'settings',  label: 'Settings' },
];

export default function AdminTabs({
  users,
  sessions,
  currentUserId,
}: {
  users: {
    id: string; email: string; role: string;
    email_verified: boolean; session_count: number; created_at: string;
  }[];
  sessions: {
    id: string; name: string; scenario_id: string;
    owner_email?: string;
    act: number;
    status: string;
    updated_at: string;
    completed_at?: string | null;
    feedback_rating?: number | null;
    feedback_comment?: string | null;
  }[];
  currentUserId: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [scenarioRefreshToken, setScenarioRefreshToken] = useState(0);

  return (
    <div>
      {/* Tab nav */}
      <div className="flex gap-0 mb-8 border-b border-stone-800">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="space-y-10">

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
                  {users.map(user => (
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
                        {user.id !== currentUserId && (
                          <RoleToggle userId={user.id} currentRole={user.role as 'user' | 'admin'} />
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
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Act</th>
                    <th className="text-left px-4 py-3">Feedback</th>
                    <th className="text-left px-4 py-3">Updated</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(session => (
                    <tr key={session.id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                      <td className="px-4 py-3 text-stone-200">{session.name}</td>
                      <td className="px-4 py-3 text-stone-400 text-xs">{session.scenario_id}</td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {session.owner_email ?? <span className="text-stone-700">anonymous</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          session.status === 'completed'
                            ? 'bg-emerald-900/50 text-emerald-300'
                            : session.status === 'paused'
                              ? 'bg-amber-900/50 text-amber-300'
                              : 'bg-stone-800 text-stone-400'
                        }`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-400">{session.act}</td>
                      <td className="px-4 py-3 text-stone-500 text-xs max-w-60">
                        {session.feedback_rating ? (
                          <div>
                            <div className="text-stone-300">{session.feedback_rating}/5</div>
                            {session.feedback_comment && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-stone-500 hover:text-stone-300">
                                  Переглянути коментар
                                </summary>
                                <div className="mt-2 max-w-60 whitespace-pre-wrap rounded-lg border border-stone-800 bg-stone-950/60 p-2 text-stone-400">
                                  {session.feedback_comment}
                                </div>
                              </details>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {new Date(session.completed_at ?? session.updated_at).toLocaleDateString()}
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
                      <td colSpan={8} className="px-4 py-8 text-center text-stone-600">
                        No sessions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}

      {activeTab === 'usage'     && <UsageTab />}
      {activeTab === 'scenarios' && (
        <div className="space-y-10">
          <ScenarioStats refreshToken={scenarioRefreshToken} />
          <ScenarioGenerator onSaved={() => setScenarioRefreshToken((token) => token + 1)} />
        </div>
      )}
      {activeTab === 'settings'  && (
        <div className="space-y-10">
          <KeeperSettings />
          <PricingEditor />
        </div>
      )}
    </div>
  );
}
