'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Scenario } from '@/types';

interface AdminScenarioSummary {
  id: string;
  title: string;
  titleUk?: string;
  era: string;
  difficulty: Scenario['difficulty'];
  rulesetId?: string;
  fileName: string;
  fileSize: number;
  updatedAt: string;
  hasCachedAssets: boolean;
  generatedBy?: Scenario['generatedBy'];
}

interface ScenarioDetail {
  scenario: Scenario;
  file: {
    path: string;
    size: number;
    updatedAt: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function sourceLabel(generatedBy?: Scenario['generatedBy']): string {
  if (!generatedBy) return 'manual / legacy';
  return `${generatedBy.provider} ${generatedBy.model}`;
}

export default function ScenarioLibrary({ refreshToken = 0, onChanged }: {
  refreshToken?: number;
  onChanged?: () => void;
}) {
  const [scenariosDir, setScenariosDir] = useState('');
  const [scenarios, setScenarios] = useState<AdminScenarioSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScenarioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadScenarios() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scenarios');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load scenarios');
      setScenariosDir(data.scenariosDir ?? '');
      setScenarios(Array.isArray(data.scenarios) ? data.scenarios : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setScenarios([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/scenarios/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load scenario');
      setDetail(data as ScenarioDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function deleteScenario(id: string) {
    const ok = window.confirm(`Delete scenario "${id}" from the live scenario directory?`);
    if (!ok) return;

    setDeletingId(id);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/admin/scenarios/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete scenario');

      setNotice(`Deleted ${id}${data.deletedCachedAssets ? ' and cached assets' : ''}.`);
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await loadScenarios();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    loadScenarios();
  }, [refreshToken]);

  const selectedJson = useMemo(() => {
    if (!detail) return '';
    return JSON.stringify(detail.scenario, null, 2);
  }, [detail]);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-stone-300 text-sm tracking-widest uppercase">Scenario Library</h3>
          <p className="mt-1 text-xs text-stone-500">
            Live files from <span className="font-mono text-stone-400">{scenariosDir || 'scenario directory'}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={loadScenarios}
          className="w-fit border border-stone-700 px-3 py-2 text-xs uppercase tracking-wide text-stone-300 transition-colors hover:border-amber-600 hover:text-amber-300"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-3 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-stone-600">Loading scenarios...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800 text-xs uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3 text-left">Scenario</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">File</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => (
                <tr key={scenario.id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-stone-200">{scenario.id}</div>
                    <div className="mt-1 text-xs text-stone-500">
                      {scenario.titleUk ?? scenario.title} · {scenario.era} · {scenario.difficulty}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400">
                    {sourceLabel(scenario.generatedBy)}
                    <div className="mt-1 text-stone-600">{scenario.rulesetId ?? 'no ruleset'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    <div>{formatBytes(scenario.fileSize)}</div>
                    <div className="mt-1">{new Date(scenario.updatedAt).toLocaleString()}</div>
                    {scenario.hasCachedAssets && <div className="mt-1 text-amber-400">cached assets</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => loadDetail(scenario.id)}
                        className="border border-stone-700 px-3 py-1.5 text-xs text-stone-300 transition-colors hover:border-amber-600 hover:text-amber-300"
                      >
                        View JSON
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === scenario.id}
                        onClick={() => deleteScenario(scenario.id)}
                        className="border border-red-900/70 px-3 py-1.5 text-xs text-red-300 transition-colors hover:border-red-500 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === scenario.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {scenarios.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-600">
                    No scenarios found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <div className="mt-6 rounded-xl border border-stone-800 bg-stone-950">
          <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3">
            <div>
              <h4 className="font-mono text-sm text-stone-200">{selectedId}</h4>
              {detail?.file && (
                <p className="mt-1 text-xs text-stone-600">
                  {formatBytes(detail.file.size)} · {new Date(detail.file.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setSelectedId(null); setDetail(null); }}
              className="border border-stone-700 px-3 py-1.5 text-xs text-stone-300 transition-colors hover:border-stone-500 hover:text-stone-100"
            >
              Close
            </button>
          </div>
          {detailLoading ? (
            <p className="px-4 py-8 text-center text-sm text-stone-600">Loading JSON...</p>
          ) : (
            <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap px-4 py-4 font-mono text-xs leading-relaxed text-stone-300">
              {selectedJson}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
