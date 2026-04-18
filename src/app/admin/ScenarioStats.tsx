'use client';

import { useState, useEffect } from 'react';

interface ScenarioRow {
  scenario_id: string;
  session_count: number;
  completed_count: number;
  early_closed_count: number;
  avg_messages: number;
  total_cost: number;
  avg_cost_per_session: number;
  avg_rating: number | null;
  rating_count: number;
  title?: string;
  titleUk?: string;
  generatedBy?: Scenario['generatedBy'];
}

interface ScenarioStatsProps {
  refreshToken?: number;
}

function emptyScenarioRow(scenarioId: string): ScenarioRow {
  return {
    scenario_id: scenarioId,
    session_count: 0,
    completed_count: 0,
    early_closed_count: 0,
    avg_messages: 0,
    total_cost: 0,
    avg_cost_per_session: 0,
    avg_rating: null,
    rating_count: 0,
  };
}

function getScenarioSourceLabel(generatedBy?: Scenario['generatedBy']): string {
  if (!generatedBy) return 'legacy';
  if (generatedBy.provider === 'gemini') return 'Gemini';
  if (generatedBy.model.includes('opus')) return 'Opus';
  return 'Claude';
}

export default function ScenarioStats({ refreshToken = 0 }: ScenarioStatsProps) {
  const [rows, setRows]       = useState<ScenarioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      try {
        const [statsRes, scenariosRes] = await Promise.all([
          fetch('/api/admin/costs?breakdown=scenarios'),
          fetch('/api/scenarios'),
        ]);

        const stats = (statsRes.ok ? await statsRes.json() : []) as ScenarioRow[];
        const scenarios = (scenariosRes.ok ? await scenariosRes.json() : []) as Array<{ id: string }>;

        const byId = new Map<string, ScenarioRow>();
        for (const scenario of scenarios) {
          byId.set(scenario.id, {
            ...emptyScenarioRow(scenario.id),
            title: scenario.title,
            titleUk: scenario.titleUk,
            generatedBy: scenario.generatedBy,
          });
        }
        for (const row of stats) {
          const existing = byId.get(row.scenario_id) ?? emptyScenarioRow(row.scenario_id);
          byId.set(row.scenario_id, { ...existing, ...row });
        }

        const merged = [...byId.values()].sort((a, b) => a.scenario_id.localeCompare(b.scenario_id));
        if (!cancelled) setRows(merged);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    loadRows();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return (
    <section>
      <h3 className="text-stone-300 text-sm tracking-widest uppercase mb-4">Scenario List</h3>
      <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
        {loading ? (
          <p className="px-4 py-8 text-center text-stone-600 text-sm">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                <th className="text-left px-4 py-3">Scenario</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-right px-4 py-3">Sessions</th>
                <th className="text-right px-4 py-3">Completed</th>
                <th className="text-right px-4 py-3">Early</th>
                <th className="text-right px-4 py-3">Avg msgs</th>
                <th className="text-right px-4 py-3">Rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.scenario_id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                  <td className="px-4 py-2.5">
                    <div className="text-stone-200 font-mono text-xs">{row.scenario_id}</div>
                    {(row.titleUk || row.title) && (
                      <div className="mt-1 text-xs text-stone-500">
                        {row.titleUk ?? row.title}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-stone-400">
                    <span className="rounded-full border border-stone-700 px-2 py-0.5">
                      {getScenarioSourceLabel(row.generatedBy)}
                    </span>
                  </td>
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
                      <span className="ml-1 text-stone-600">({row.rating_count})</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-600">No scenario data yet</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
