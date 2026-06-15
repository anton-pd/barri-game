'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Period } from '@/lib/costTracker';

// ── Types ────────────────────────────────────────────────────────────────────

interface ModelRow {
  provider: string; model: string; type: string;
  calls: number; input_tokens: number | null; output_tokens: number | null;
  characters: number | null; image_count: number | null; total_cost: number;
}

interface SessionModelRow {
  session_id: string; provider: string; model: string; type: string;
  calls: number; input_tokens: number | null; output_tokens: number | null;
  characters: number | null; image_count: number | null; cost: number;
}

interface SessionRow {
  session_name: string; scenario_id: string; session_id: string;
  player_count: number; message_count: number; keeper_message_count: number;
  calls: number; total_cost: number;
  avg_output_tokens: number | null; avg_input_tokens: number | null;
  last_used: string;
  models: SessionModelRow[];
}

interface AccountModelRow {
  user_id: string; provider: string; model: string; type: string;
  calls: number; input_tokens: number | null; output_tokens: number | null;
  characters: number | null; image_count: number | null; cost: number;
}

interface AccountRow {
  user_id: string; email: string; session_count: number;
  total_cost: number; last_active: string;
  models: AccountModelRow[];
}

interface ScenarioUsageRow {
  scenario_id: string;
  session_count: number;
  completed_count: number;
  early_closed_count: number;
  avg_messages: number;
  total_cost: number;
  avg_cost_per_session: number;
  avg_rating: number | null;
  rating_count: number;
}

interface AnonymousDemoModelRow {
  scenario_id: string; provider: string; model: string; type: string;
  calls: number; input_tokens: number | null; output_tokens: number | null;
  characters: number | null; image_count: number | null; cost: number;
}

interface AnonymousDemoRow {
  scenario_id: string;
  anonymous_sessions: number;
  calls: number;
  input_tokens: number | null;
  output_tokens: number | null;
  characters: number | null;
  image_count: number | null;
  total_cost: number;
  avg_cost_per_session: number;
  last_active: string;
  models: AnonymousDemoModelRow[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtN(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

function fmtCost(n: number | null | undefined): string {
  return `$${(n ?? 0).toFixed(4)}`;
}

function renderInput(row: { type?: string; input_tokens?: number | null; characters?: number | null }) {
  if (row.input_tokens) return `${fmtN(row.input_tokens)} tok`;
  // Fallback for old TTS records without input_tokens: estimate from chars
  if (row.type === 'tts' && row.characters) return `~${fmtN(Math.round(row.characters / 4))} tok`;
  return '—';
}

function renderOutput(row: { type?: string; output_tokens?: number | null; characters?: number | null; image_count?: number | null }) {
  if (row.output_tokens) return `${fmtN(row.output_tokens)} tok`;
  // Fallback for old TTS records without output_tokens
  if (row.type === 'tts' && row.characters) return `~${fmtN(Math.round(row.characters / 4))} tok`;
  if (row.image_count) return `${row.image_count} img`;
  return '—';
}

// ── Period filter ─────────────────────────────────────────────────────────────

const PERIOD_OPTS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all',   label: 'All' },
  { value: 'custom', label: 'Date' },
];

// ── Shared model breakdown sub-table ─────────────────────────────────────────

function ModelBreakdownTable({ rows }: { rows: { provider: string; model: string; type: string; calls: number; input_tokens: number | null; output_tokens: number | null; characters: number | null; image_count: number | null; cost: number }[] }) {
  return (
    <table className="w-full text-xs mt-1">
      <thead>
        <tr className="text-stone-600 uppercase tracking-wide">
          <th className="text-left py-1 pr-6">Model</th>
          <th className="text-left pr-6">Type</th>
          <th className="text-right pr-6">Calls</th>
          <th className="text-right pr-6">Input</th>
          <th className="text-right pr-6">Output</th>
          <th className="text-right">Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m, i) => (
          <tr key={i} className="text-stone-400">
            <td className="py-0.5 pr-6 font-mono text-stone-300">{m.model}</td>
            <td className="pr-6">
              <span className="px-1 py-0.5 rounded bg-stone-800 text-stone-500">{m.type}</span>
            </td>
            <td className="text-right pr-6">{m.calls}</td>
            <td className="text-right pr-6 text-stone-500">{renderInput(m)}</td>
            <td className="text-right pr-6 text-stone-500">{renderOutput(m)}</td>
            <td className="text-right text-amber-700">{fmtCost(m.cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UsageTab() {
  const [period, setPeriod] = useState<Period>('month');
  const [customDate, setCustomDate] = useState('');

  const [modelRows,    setModelRows]    = useState<ModelRow[]>([]);
  const [sessionRows,  setSessionRows]  = useState<SessionRow[]>([]);
  const [accountRows,  setAccountRows]  = useState<AccountRow[]>([]);
  const [scenarioRows, setScenarioRows] = useState<ScenarioUsageRow[]>([]);
  const [anonymousDemoRows, setAnonymousDemoRows] = useState<AnonymousDemoRow[]>([]);

  const [loadingModels,   setLoadingModels]   = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [loadingAnonymousDemo, setLoadingAnonymousDemo] = useState(true);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedAnonymousDemo, setExpandedAnonymousDemo] = useState<Set<string>>(new Set());

  function buildPeriodParams(p: Period, d: string) {
    const params = new URLSearchParams({ period: p });
    if (p === 'custom' && d) params.set('date', d);
    return params.toString();
  }

  const fetchModels = useCallback(async (p: Period, d: string) => {
    if (p === 'custom' && !d) return;
    setLoadingModels(true);
    try {
      const res = await fetch(`/api/admin/costs?breakdown=model&${buildPeriodParams(p, d)}`);
      if (res.ok) setModelRows(await res.json());
    } finally { setLoadingModels(false); }
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/admin/costs?breakdown=sessions-enhanced');
      if (res.ok) setSessionRows(await res.json());
    } finally { setLoadingSessions(false); }
  }, []);

  const fetchAccounts = useCallback(async (p: Period, d: string) => {
    if (p === 'custom' && !d) return;
    setLoadingAccounts(true);
    try {
      const res = await fetch(`/api/admin/costs?breakdown=accounts&${buildPeriodParams(p, d)}`);
      if (res.ok) setAccountRows(await res.json());
    } finally {
      setLoadingAccounts(false);
      setLastUpdated(new Date());
    }
  }, []);

  const fetchAnonymousDemo = useCallback(async (p: Period, d: string) => {
    if (p === 'custom' && !d) return;
    setLoadingAnonymousDemo(true);
    try {
      const res = await fetch(`/api/admin/costs?breakdown=anonymous-demo&${buildPeriodParams(p, d)}`);
      if (res.ok) setAnonymousDemoRows(await res.json());
    } finally { setLoadingAnonymousDemo(false); }
  }, []);

  const fetchScenarios = useCallback(async () => {
    setLoadingScenarios(true);
    try {
      const res = await fetch('/api/admin/costs?breakdown=scenarios');
      if (res.ok) setScenarioRows(await res.json());
    } finally { setLoadingScenarios(false); }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSessions();
    fetchScenarios();
    fetchModels('month', '');
    fetchAccounts('month', '');
    fetchAnonymousDemo('month', '');
  }, [fetchSessions, fetchScenarios, fetchModels, fetchAccounts, fetchAnonymousDemo]);

  // Re-fetch on period change
  function applyPeriod(p: Period, d: string) {
    setPeriod(p);
    fetchModels(p, d);
    fetchAccounts(p, d);
    fetchAnonymousDemo(p, d);
  }

  function toggleSession(id: string) {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAccount(id: string) {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAnonymousDemo(id: string) {
    setExpandedAnonymousDemo(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalModelCost = modelRows.reduce((s, r) => s + (r.total_cost ?? 0), 0);

  return (
    <div className="space-y-10">

      {/* Period filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-stone-500 text-xs uppercase tracking-wide mr-1">Period:</span>
        {PERIOD_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => {
              if (opt.value === 'custom') { setPeriod('custom'); return; }
              applyPeriod(opt.value, '');
            }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border ${
              period === opt.value
                ? 'bg-amber-800/60 text-amber-200 border-amber-700'
                : 'bg-stone-800 text-stone-400 border-stone-700 hover:border-stone-600 hover:text-stone-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {period === 'custom' && (
          <input
            type="date"
            value={customDate}
            onChange={e => { setCustomDate(e.target.value); applyPeriod('custom', e.target.value); }}
            className="px-3 py-1 text-xs bg-stone-800 border border-stone-600 text-stone-300 focus:outline-none focus:border-amber-600"
          />
        )}
        <div className="flex-1" />
        <button
          onClick={() => { fetchModels(period, customDate); fetchAccounts(period, customDate); fetchAnonymousDemo(period, customDate); fetchSessions(); fetchScenarios(); }}
          className="text-xs px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-400 transition-colors border border-stone-700"
        >
          ↻ Refresh
        </button>
        {lastUpdated && (
          <span className="text-stone-600 text-xs">{lastUpdated.toLocaleTimeString()}</span>
        )}
      </div>

      {/* ── Models ─────────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-stone-300 text-sm tracking-widest uppercase mb-4">By Model</h3>
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          {loadingModels ? (
            <p className="px-4 py-8 text-center text-stone-600 text-sm">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                  <th className="text-left px-4 py-3">Model</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">Calls</th>
                  <th className="text-right px-4 py-3">Input</th>
                  <th className="text-right px-4 py-3">Output</th>
                  <th className="text-right px-4 py-3">Cost $</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((row, i) => (
                  <tr key={i} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                    <td className="px-4 py-2.5 text-stone-200 font-mono text-xs">{row.model}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">{row.type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-400">{row.calls}</td>
                    <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                      {renderInput(row)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                      {renderOutput(row)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-600 font-medium">
                      {fmtCost(row.total_cost)}
                    </td>
                  </tr>
                ))}
                {modelRows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-600">No data for this period</td></tr>
                )}
                {modelRows.length > 0 && (
                  <tr className="bg-stone-800/40">
                    <td colSpan={5} className="px-4 py-2.5 text-stone-400 text-xs font-medium uppercase">Total</td>
                    <td className="px-4 py-2.5 text-right text-amber-500 font-semibold">{fmtCost(totalModelCost)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Anonymous Demo ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-stone-300 text-sm tracking-widest uppercase">Anonymous Demo</h3>
          <span className="text-stone-600 text-xs">period-aware · public instant demo · click row to expand</span>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          {loadingAnonymousDemo ? (
            <p className="px-4 py-8 text-center text-stone-600 text-sm">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                  <th className="text-left px-4 py-3">Demo</th>
                  <th className="text-right px-4 py-3">Sessions</th>
                  <th className="text-right px-4 py-3">Calls</th>
                  <th className="text-right px-4 py-3">Input</th>
                  <th className="text-right px-4 py-3">Output</th>
                  <th className="text-right px-4 py-3">Avg / session</th>
                  <th className="text-right px-4 py-3">Cost $</th>
                </tr>
              </thead>
              <tbody>
                {anonymousDemoRows.map(row => {
                  const expanded = expandedAnonymousDemo.has(row.scenario_id);
                  return [
                    <tr
                      key={row.scenario_id}
                      className="border-b border-stone-800/50 hover:bg-stone-800/30 cursor-pointer select-none"
                      onClick={() => toggleAnonymousDemo(row.scenario_id)}
                    >
                      <td className="px-4 py-2.5 text-stone-200 font-mono text-xs">
                        <span className="text-stone-600 text-xs mr-1.5">{expanded ? '▼' : '▶'}</span>
                        {row.scenario_id}
                        <span className="ml-2 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-500">
                          no account
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-stone-400">{row.anonymous_sessions}</td>
                      <td className="px-4 py-2.5 text-right text-stone-400">{row.calls}</td>
                      <td className="px-4 py-2.5 text-right text-stone-500 text-xs">{renderInput(row)}</td>
                      <td className="px-4 py-2.5 text-right text-stone-500 text-xs">{renderOutput(row)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-700 text-xs">
                        {fmtCost(row.avg_cost_per_session)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-600 font-medium">
                        {fmtCost(row.total_cost)}
                      </td>
                    </tr>,
                    expanded && row.models.length > 0 && (
                      <tr key={`${row.scenario_id}-detail`} className="border-b border-stone-800/50 bg-stone-950/60">
                        <td colSpan={7} className="px-10 py-3">
                          <ModelBreakdownTable rows={row.models} />
                          <div className="mt-2 text-[11px] text-stone-600">
                            Last active: {new Date(row.last_active).toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
                {anonymousDemoRows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-600">No anonymous demo usage for this period</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Sessions ───────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-stone-300 text-sm tracking-widest uppercase">Sessions</h3>
          <span className="text-stone-600 text-xs">all time · top 50 by cost · click row to expand</span>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          {loadingSessions ? (
            <p className="px-4 py-8 text-center text-stone-600 text-sm">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                  <th className="text-left px-4 py-3">Session</th>
                  <th className="text-left px-4 py-3">Scenario</th>
                  <th className="text-right px-4 py-3">Players</th>
                  <th className="text-right px-4 py-3">Msgs (keeper)</th>
                  <th className="text-right px-4 py-3">Avg out tok</th>
                  <th className="text-right px-4 py-3">Avg in tok</th>
                  <th className="text-right px-4 py-3">Cost $</th>
                </tr>
              </thead>
              <tbody>
                {sessionRows.map(row => {
                  const expanded = expandedSessions.has(row.session_id);
                  return [
                    <tr
                      key={row.session_id}
                      className="border-b border-stone-800/50 hover:bg-stone-800/30 cursor-pointer select-none"
                      onClick={() => toggleSession(row.session_id)}
                    >
                      <td className="px-4 py-2.5 text-stone-200">
                        <span className="text-stone-600 text-xs mr-1.5">{expanded ? '▼' : '▶'}</span>
                        <Link
                          href={`/session/${row.session_id}`}
                          className="hover:text-amber-500 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          {row.session_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-stone-500 text-xs">{row.scenario_id}</td>
                      <td className="px-4 py-2.5 text-right text-stone-400">{row.player_count}</td>
                      <td className="px-4 py-2.5 text-right text-stone-400">
                        {row.message_count}
                        {row.keeper_message_count > 0 && (
                          <span className="text-stone-600 text-xs ml-1">({row.keeper_message_count})</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                        {row.avg_output_tokens != null ? Math.round(row.avg_output_tokens).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                        {row.avg_input_tokens != null ? Math.round(row.avg_input_tokens).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-600 font-medium">
                        {fmtCost(row.total_cost)}
                      </td>
                    </tr>,
                    expanded && row.models.length > 0 && (
                      <tr key={`${row.session_id}-detail`} className="border-b border-stone-800/50 bg-stone-950/60">
                        <td colSpan={7} className="px-10 py-3">
                          <ModelBreakdownTable rows={row.models} />
                        </td>
                      </tr>
                    ),
                  ];
                })}
                {sessionRows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-600">No session data yet</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Scenarios ──────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-stone-300 text-sm tracking-widest uppercase">By Scenario</h3>
          <span className="text-stone-600 text-xs">all time</span>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          {loadingScenarios ? (
            <p className="px-4 py-8 text-center text-stone-600 text-sm">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                  <th className="text-left px-4 py-3">Scenario</th>
                  <th className="text-right px-4 py-3">Sessions</th>
                  <th className="text-right px-4 py-3">Completed</th>
                  <th className="text-right px-4 py-3">Early</th>
                  <th className="text-right px-4 py-3">Avg msgs</th>
                  <th className="text-right px-4 py-3">Rating</th>
                  <th className="text-right px-4 py-3">Avg cost $</th>
                  <th className="text-right px-4 py-3">Total cost $</th>
                </tr>
              </thead>
              <tbody>
                {scenarioRows.map(row => (
                  <tr key={row.scenario_id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                    <td className="px-4 py-2.5 text-stone-200 font-mono text-xs">{row.scenario_id}</td>
                    <td className="px-4 py-2.5 text-right text-stone-400">{row.session_count}</td>
                    <td className="px-4 py-2.5 text-right text-stone-400">
                      {row.completed_count}
                      {row.session_count > 0 && (
                        <span className="text-stone-600 text-xs ml-1">
                          ({Math.round((row.completed_count / row.session_count) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-300">
                      {row.early_closed_count}
                      {row.session_count > 0 && row.early_closed_count > 0 && (
                        <span className="text-stone-600 text-xs ml-1">
                          ({Math.round((row.early_closed_count / row.session_count) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                      {Math.round(row.avg_messages)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                      {row.avg_rating != null ? `${row.avg_rating.toFixed(1)} / 5` : '—'}
                      {row.rating_count > 0 && (
                        <span className="text-stone-600 text-xs ml-1">({row.rating_count})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-700 text-xs">
                      {fmtCost(row.avg_cost_per_session)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-600 font-medium">
                      {fmtCost(row.total_cost)}
                    </td>
                  </tr>
                ))}
                {scenarioRows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-600">No data yet</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Accounts ───────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-stone-300 text-sm tracking-widest uppercase mb-4">By Account</h3>
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          {loadingAccounts ? (
            <p className="px-4 py-8 text-center text-stone-600 text-sm">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                  <th className="text-left px-4 py-3">Account</th>
                  <th className="text-right px-4 py-3">Sessions</th>
                  <th className="text-right px-4 py-3">Last Active</th>
                  <th className="text-right px-4 py-3">Cost $</th>
                </tr>
              </thead>
              <tbody>
                {accountRows.map(row => {
                  const expanded = expandedAccounts.has(row.user_id);
                  return [
                    <tr
                      key={row.user_id}
                      className="border-b border-stone-800/50 hover:bg-stone-800/30 cursor-pointer select-none"
                      onClick={() => toggleAccount(row.user_id)}
                    >
                      <td className="px-4 py-2.5 text-stone-200">
                        <span className="text-stone-600 text-xs mr-1.5">{expanded ? '▼' : '▶'}</span>
                        {row.email}
                      </td>
                      <td className="px-4 py-2.5 text-right text-stone-400">{row.session_count}</td>
                      <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                        {new Date(row.last_active).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-600 font-medium">
                        {fmtCost(row.total_cost)}
                      </td>
                    </tr>,
                    expanded && row.models.length > 0 && (
                      <tr key={`${row.user_id}-detail`} className="border-b border-stone-800/50 bg-stone-950/60">
                        <td colSpan={4} className="px-10 py-3">
                          <ModelBreakdownTable rows={row.models} />
                        </td>
                      </tr>
                    ),
                  ];
                })}
                {accountRows.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-600">No account data for this period</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

    </div>
  );
}
