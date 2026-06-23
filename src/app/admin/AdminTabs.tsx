'use client';

import { useState } from 'react';
import Link from 'next/link';
import RoleToggle from './RoleToggle';
import AccessControl from './AccessControl';
import type { AccessStatus } from '@/types';
import KeeperSettings from './KeeperSettings';
import ScenarioGenerator from './ScenarioGenerator';
import ScenarioLibrary from './ScenarioLibrary';
import ScenarioStats from './ScenarioStats';
import UsageTab from './UsageTab';
import PricingEditor from './PricingEditor';
import { useRouter } from 'next/navigation';
import type { AdminWaitlistResult, WaitlistLifecycleStatus } from '@/lib/queries';

type Tab = 'waitlist' | 'users' | 'usage' | 'scenarios' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'waitlist',  label: 'Waitlist' },
  { id: 'users',     label: 'Users' },
  { id: 'usage',     label: 'Usage' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'settings',  label: 'Settings' },
];

function accessMeta(status: string): { label: string; className: string } {
  switch (status) {
    case 'approved':
      return { label: 'approved', className: 'bg-emerald-900/50 text-emerald-300' };
    case 'blocked':
      return { label: 'blocked', className: 'bg-red-900/50 text-red-300' };
    default:
      return { label: 'waiting list', className: 'bg-amber-900/50 text-amber-300' };
  }
}

function getSessionStatusMeta(session: {
  status: string;
  ended_early?: boolean | null;
  completion_trigger?: string | null;
}) {
  if (session.status === 'completed') {
    if (session.ended_early) {
      return {
        label: 'closed early',
        className: 'bg-amber-900/50 text-amber-300',
      };
    }
    return {
      label: session.completion_trigger === 'keeper' ? 'completed by keeper' : 'completed',
      className: 'bg-emerald-900/50 text-emerald-300',
    };
  }

  if (session.status === 'paused') {
    return {
      label: 'paused',
      className: 'bg-amber-900/50 text-amber-300',
    };
  }

  return {
    label: 'active',
    className: 'bg-stone-800 text-stone-400',
  };
}

function lifecycleMeta(status: WaitlistLifecycleStatus): { label: string; className: string } {
  switch (status) {
    case 'active_user':
      return { label: 'active user', className: 'bg-emerald-900/50 text-emerald-300' };
    case 'account_created':
      return { label: 'account created', className: 'bg-sky-900/50 text-sky-300' };
    case 'invited':
      return { label: 'invited', className: 'bg-violet-900/50 text-violet-300' };
    case 'blocked':
      return { label: 'blocked', className: 'bg-red-900/50 text-red-300' };
    default:
      return { label: 'waiting', className: 'bg-amber-900/50 text-amber-300' };
  }
}

function WaitlistInviteButton({ email, locale, invited }: { email: string; locale?: string | null; invited: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function invite() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/waitlist/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={invite}
        disabled={loading}
        className="text-xs text-amber-500 hover:text-amber-300 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Sending...' : invited ? 'Resend invite' : 'Open access'}
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900 px-4 py-3">
      <div className="text-2xl font-semibold text-amber-400">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-stone-500">{label}</div>
      <div className="mt-2 text-xs text-stone-600">{hint}</div>
    </div>
  );
}

export default function AdminTabs({
  users,
  sessions,
  waitlist,
  currentUserId,
}: {
  users: {
    id: string; email: string; role: string;
    email_verified: boolean; access_status: string;
    session_count: number; daily_cost: number; created_at: string;
  }[];
  sessions: {
    id: string; name: string; scenario_id: string;
    owner_email?: string;
    act: number;
    status: string;
    ended_early?: boolean | null;
    completion_trigger?: 'keeper' | 'manual' | null;
    updated_at: string;
    completed_at?: string | null;
    feedback_rating?: number | null;
    feedback_comment?: string | null;
  }[];
  waitlist: AdminWaitlistResult;
  currentUserId: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('waitlist');
  const [scenarioRefreshToken, setScenarioRefreshToken] = useState(0);
  const pendingCount = users.filter((u) => u.access_status === 'pending').length;

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

      {/* Waitlist tab */}
      {activeTab === 'waitlist' && (
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-stone-300 text-sm tracking-widest uppercase">
                  Waiting List ({waitlist.metrics.total})
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  Track people from the public/demo intake, open access, and see who activated an account.
                </p>
              </div>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Invited" value={`${waitlist.metrics.invitedPercent}%`} hint={`${waitlist.metrics.invited} of ${waitlist.metrics.total} received access`} />
              <MetricCard label="Active" value={`${waitlist.metrics.activePercent}%`} hint={`${waitlist.metrics.activeUsers} verified active users`} />
              <MetricCard label="Waiting" value={waitlist.metrics.waiting} hint="No invite sent yet" />
              <MetricCard label="Accounts" value={waitlist.metrics.accountCreated} hint="Created from invite or matched by email" />
            </div>

            <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Account</th>
                    <th className="px-4 py-3 text-left">Source</th>
                    <th className="px-4 py-3 text-left">Invite</th>
                    <th className="px-4 py-3 text-left">Joined</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.entries.map((entry) => {
                    const lifecycle = lifecycleMeta(entry.lifecycle_status);
                    const account = entry.user_id
                      ? `${entry.access_status ?? 'unknown'} · ${entry.email_verified ? 'verified' : 'not verified'}`
                      : 'no account';
                    return (
                      <tr key={entry.id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                        <td className="px-4 py-3 text-stone-200">
                          <div>{entry.email}</div>
                          {entry.notes && <div className="mt-1 max-w-72 truncate text-xs text-stone-600">{entry.notes}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${lifecycle.className}`}>
                            {lifecycle.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          <div>{account}</div>
                          {entry.session_count > 0 && (
                            <div className="mt-1 text-stone-600">{entry.session_count} sessions</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          <div>{entry.source}</div>
                          <div className="mt-1 text-stone-600">{entry.locale ?? 'en'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          {entry.last_invite_sent_at
                            ? new Date(entry.last_invite_sent_at).toLocaleDateString()
                            : <span className="text-stone-700">not sent</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {entry.lifecycle_status !== 'active_user' && entry.lifecycle_status !== 'blocked' && (
                            <WaitlistInviteButton
                              email={entry.email}
                              locale={entry.locale}
                              invited={Boolean(entry.invited_at || entry.access_opened_at)}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {waitlist.entries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-stone-600">
                        No waitlist entries yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="space-y-10">

          <section>
            <h2 className="text-stone-300 text-sm tracking-widest uppercase mb-4">
              Investigators ({users.length})
              {pendingCount > 0 && (
                <span className="ml-3 text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 normal-case tracking-normal">
                  {pendingCount} awaiting access
                </span>
              )}
            </h2>
            <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-left px-4 py-3">Verified</th>
                    <th className="text-left px-4 py-3">Access</th>
                    <th className="text-left px-4 py-3">Today $</th>
                    <th className="text-left px-4 py-3">Sessions</th>
                    <th className="text-left px-4 py-3">Joined</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const access = accessMeta(user.access_status);
                    return (
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
                          ? <span className="text-emerald-500 text-xs">verified</span>
                          : <span className="text-stone-600 text-xs">pending</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${access.className}`}>
                          {access.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-400 text-xs">
                        ${(user.daily_cost ?? 0).toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-stone-400">{user.session_count}</td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 items-start">
                          {user.id !== currentUserId && (
                            <AccessControl
                              userId={user.id}
                              currentStatus={user.access_status as AccessStatus}
                            />
                          )}
                          {user.id !== currentUserId && (
                            <RoleToggle userId={user.id} currentRole={user.role as 'user' | 'admin'} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-stone-600">
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
                  {sessions.map(session => {
                    const statusMeta = getSessionStatusMeta(session);
                    return (
                    <tr key={session.id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                      <td className="px-4 py-3 text-stone-200">{session.name}</td>
                      <td className="px-4 py-3 text-stone-400 text-xs">{session.scenario_id}</td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {session.owner_email ?? <span className="text-stone-700">anonymous</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusMeta.className}`}>
                          {statusMeta.label}
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
                  )})}
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
          <ScenarioLibrary
            refreshToken={scenarioRefreshToken}
            onChanged={() => setScenarioRefreshToken((token) => token + 1)}
          />
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
