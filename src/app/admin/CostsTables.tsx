'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ModelRow {
  provider: string; model: string; type: string;
  calls: number; input_tokens: number | null; output_tokens: number | null;
  characters: number | null; image_count: number | null; total_cost: number;
}
interface SessionRow {
  session_name: string; scenario_id: string; session_id: string;
  calls: number; total_cost: number; last_used: string;
}
interface CostsData { modelRows: ModelRow[]; sessionRows: SessionRow[] }

export default function CostsTables() {
  const [data, setData]       = useState<CostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [mRes, sRes] = await Promise.all([
        fetch('/api/admin/costs?breakdown=model'),
        fetch('/api/admin/costs?breakdown=session'),
      ]);
      if (!mRes.ok || !sRes.ok) return;
      const [modelRows, sessionRows] = await Promise.all([mRes.json(), sRes.json()]);
      setData({ modelRows, sessionRows });
      setLastUpdated(new Date());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (loading) return <p className="text-stone-600 text-sm py-4">Завантаження...</p>;
  if (!data) return <p className="text-stone-600 text-sm py-4">Помилка завантаження</p>;

  const { modelRows, sessionRows } = data;
  const totalCost = modelRows.reduce((s, r) => s + (r.total_cost ?? 0), 0);

  return (
    <div className="space-y-10">
      {/* By model */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-stone-300 text-sm tracking-widest uppercase">
            API Costs — by model (30 days)
          </h2>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-stone-600 text-xs">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              className="text-xs px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-400 rounded-lg transition-colors"
            >
              ↻ оновити
            </button>
          </div>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                <th className="text-left px-4 py-3">Model</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Calls</th>
                <th className="text-right px-4 py-3">Input tok</th>
                <th className="text-right px-4 py-3">Output tok / chars</th>
                <th className="text-right px-4 py-3">Est. cost $</th>
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
                    {row.input_tokens ? Number(row.input_tokens).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                    {row.output_tokens ? Number(row.output_tokens).toLocaleString()
                      : row.characters  ? `${Number(row.characters).toLocaleString()} ch`
                      : row.image_count ? `${row.image_count} img`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-amber-600 font-medium">
                    ${(row.total_cost ?? 0).toFixed(4)}
                  </td>
                </tr>
              ))}
              {modelRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-600">No data yet</td></tr>
              )}
              {modelRows.length > 0 && (
                <tr className="bg-stone-800/40">
                  <td colSpan={5} className="px-4 py-2.5 text-stone-400 text-xs font-medium uppercase">Total</td>
                  <td className="px-4 py-2.5 text-right text-amber-500 font-semibold">${totalCost.toFixed(4)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* By session */}
      <section>
        <h2 className="text-stone-300 text-sm tracking-widest uppercase mb-4">
          API Costs — by session (30 days, top 20)
        </h2>
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
                <th className="text-left px-4 py-3">Session</th>
                <th className="text-left px-4 py-3">Scenario</th>
                <th className="text-right px-4 py-3">Calls</th>
                <th className="text-right px-4 py-3">Last used</th>
                <th className="text-right px-4 py-3">Est. cost $</th>
              </tr>
            </thead>
            <tbody>
              {sessionRows.map((row) => (
                <tr key={row.session_id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                  <td className="px-4 py-2.5 text-stone-200">
                    <Link href={`/session/${row.session_id}`} className="hover:text-amber-500 transition-colors">
                      {row.session_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-stone-500 text-xs">{row.scenario_id}</td>
                  <td className="px-4 py-2.5 text-right text-stone-400">{row.calls}</td>
                  <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                    {new Date(row.last_used).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-amber-600 font-medium">
                    ${(row.total_cost ?? 0).toFixed(4)}
                  </td>
                </tr>
              ))}
              {sessionRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-600">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
