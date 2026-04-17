'use client';

import { useState, useEffect } from 'react';

interface ScenarioRow {
  scenario_id: string;
  session_count: number;
  completed_count: number;
  avg_messages: number;
  total_cost: number;
  avg_cost_per_session: number;
  avg_rating: number | null;
  rating_count: number;
}

export default function ScenarioStats() {
  const [rows, setRows]       = useState<ScenarioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/costs?breakdown=scenarios')
      .then(r => r.ok ? r.json() : [])
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

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
                <th className="text-right px-4 py-3">Sessions</th>
                <th className="text-right px-4 py-3">Completed</th>
                <th className="text-right px-4 py-3">Avg msgs</th>
                <th className="text-right px-4 py-3">Rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
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
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-600">No scenario data yet</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
