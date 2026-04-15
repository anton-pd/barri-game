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

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtN(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

function fmtCost(n: number | null | undefined): string {
  return `$${(n ?? 0).toFixed(4)}`;
}

function renderOutput(row: { output_tokens?: number | null; characters?: number | null; image_count?: number | null }) {
  if (row.output_tokens) return fmtN(row.output_tokens);
  if (row.characters)    return `${fmtN(row.characters)} ch`;
  if (row.image_count)   return `${row.image_count} img`;
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
          <th className="text-right pr-6">Input tok</th>
          <th className="text-right pr-6">Output / chars / img</th>
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
            <td className="text-right pr-6 text-stone-500">{fmtN(m.input_tokens)}</td>
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

  const [modelRows,   setModelRows]   = useState<ModelRow[]>([]);
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);

  const [loadingModels,   setLoadingModels]   = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

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

  // Initial load
  useEffect(() => {
    fetchSessions();
    fetchModels('month', '');
    fetchAccounts('month', '');
  }, [fetchSessions, fetchModels, fetchAccounts]);

  // Re-fetch on period change
  function applyPeriod(p: Period, d: string) {
    setPeriod(p);
    fetchModels(p, d);
    fetchAccounts(p, d);
  }

  function toggleSession(id: string) {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAccount(id: string) {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
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
            className="px-3 py-1 rounded-lg text-xs bg-stone-800 border border-stone-600 text-stone-300 focus:outline-none focus:border-amber-600"
          />
        )}
        <div className="flex-1" />
        <button
          onClick={() => { fetchModels(period, customDate); fetchAccounts(period, customDate); fetchSessions(); }}
          className="text-xs px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-400 rounded-lg transition-colors border border-stone-700"
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
                  <th className="text-right px-4 py-3">Input tok</th>
                  <th className="text-right px-4 py-3">Output / chars / img</th>
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
                      {fmtN(row.input_tokens)}
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
