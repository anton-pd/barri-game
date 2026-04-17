'use client';

import { useState, useEffect } from 'react';

interface PricingRow {
  provider: string;
  model: string;
  metric: string;
  value_usd: number;
  updated_at: string;
}

// perChar stored internally → display/edit as $/1M tokens (4 chars/token)
function toDisplay(metric: string, value: number): number {
  if (metric === 'perChar') return parseFloat((value * 4_000_000).toPrecision(6));
  return value;
}
function toStorage(metric: string, displayValue: number): number {
  if (metric === 'perChar') return displayValue / 4_000_000;
  return displayValue;
}

type ModelGroup = {
  provider: string;
  model: string;
  metrics: Record<string, number>; // metric → stored value_usd
  updated_at: string;
};

function unitLabel(metric: string): string {
  switch (metric) {
    case 'perChar':    return '$/1M tok (TTS)';
    case 'perImage':   return '$/image';
    case 'perMinute':  return '$/min';
    default:           return metric;
  }
}

function providerColor(p: string) {
  if (p === 'anthropic') return 'bg-amber-900/40 text-amber-400';
  if (p === 'gemini')    return 'bg-blue-900/40 text-blue-400';
  return 'bg-stone-700 text-stone-400';
}

export default function PricingEditor() {
  const [rows, setRows]     = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  // edits keyed by `provider|model|metric`
  const [edits, setEdits]   = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});  // keyed by `provider|model`
  const [saved,  setSaved]  = useState<Record<string, boolean>>({});

  function fieldKey(provider: string, model: string, metric: string) {
    return `${provider}|${model}|${metric}`;
  }
  function modelKey(provider: string, model: string) {
    return `${provider}|${model}`;
  }

  useEffect(() => {
    fetch('/api/admin/pricing')
      .then(r => r.json())
      .then((data: PricingRow[]) => {
        setRows(data);
        const initial: Record<string, string> = {};
        for (const r of data) {
          initial[fieldKey(r.provider, r.model, r.metric)] = String(toDisplay(r.metric, r.value_usd));
        }
        setEdits(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  // Group by provider+model, preserve insertion order
  const groups: ModelGroup[] = [];
  const seen = new Map<string, ModelGroup>();
  for (const r of rows) {
    const mk = modelKey(r.provider, r.model);
    if (!seen.has(mk)) {
      const g: ModelGroup = { provider: r.provider, model: r.model, metrics: {}, updated_at: r.updated_at };
      seen.set(mk, g);
      groups.push(g);
    }
    seen.get(mk)!.metrics[r.metric] = r.value_usd;
    // use latest updated_at for the group
    if (r.updated_at > seen.get(mk)!.updated_at) seen.get(mk)!.updated_at = r.updated_at;
  }

  async function saveModel(g: ModelGroup) {
    const mk = modelKey(g.provider, g.model);
    setSaving(s => ({ ...s, [mk]: true }));
    try {
      await Promise.all(
        Object.entries(g.metrics).map(([metric]) => {
          const fk = fieldKey(g.provider, g.model, metric);
          const displayVal = parseFloat(edits[fk] ?? '0');
          if (isNaN(displayVal) || displayVal < 0) return Promise.resolve();
          return fetch('/api/admin/pricing', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider:  g.provider,
              model:     g.model,
              metric,
              value_usd: toStorage(metric, displayVal),
            }),
          });
        })
      );
      setSaved(s => ({ ...s, [mk]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [mk]: false })), 2000);
      // update local stored values
      setRows(prev => prev.map(r => {
        if (r.provider !== g.provider || r.model !== g.model) return r;
        const fk = fieldKey(r.provider, r.model, r.metric);
        const displayVal = parseFloat(edits[fk] ?? String(toDisplay(r.metric, r.value_usd)));
        return { ...r, value_usd: toStorage(r.metric, displayVal), updated_at: new Date().toISOString() };
      }));
    } finally {
      setSaving(s => ({ ...s, [mk]: false }));
    }
  }

  function isDirty(g: ModelGroup): boolean {
    return Object.entries(g.metrics).some(([metric, stored]) => {
      const fk = fieldKey(g.provider, g.model, metric);
      return parseFloat(edits[fk] ?? '') !== toDisplay(metric, stored);
    });
  }

  function numInput(provider: string, model: string, metric: string, placeholder?: string) {
    const fk = fieldKey(provider, model, metric);
    return (
      <div className="flex items-center gap-1">
        <span className="text-stone-600 text-xs">$</span>
        <input
          type="number"
          min="0"
          step="any"
          placeholder={placeholder}
          value={edits[fk] ?? ''}
          onChange={e => setEdits(prev => ({ ...prev, [fk]: e.target.value }))}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const g = groups.find(g => g.provider === provider && g.model === model);
              if (g) saveModel(g);
            }
          }}
          className="w-24 px-2 py-1 rounded bg-stone-800 border border-stone-700 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
    );
  }

  // LLM = has outputPer1M (image models have inputPer1M but no outputPer1M)
  const llmGroups   = groups.filter(g => 'outputPer1M' in g.metrics);
  const otherGroups = groups.filter(g => !('outputPer1M' in g.metrics));

  if (loading) return <p className="text-stone-600 text-sm py-4">Завантаження...</p>;

  function renderGroup(g: ModelGroup) {
    const mk        = modelKey(g.provider, g.model);
    const dirty     = isDirty(g);
    const hasInput  = 'inputPer1M' in g.metrics;
    const hasOutput = 'outputPer1M' in g.metrics;
    const hasChar   = 'perChar'    in g.metrics;

    // Unit = any metric except inputPer1M, outputPer1M, perChar
    // perChar is shown in the input column (TTS input price = chars billed = input)
    const unitMetric = Object.keys(g.metrics).find(m => !['inputPer1M', 'outputPer1M', 'perChar'].includes(m));

    return (
      <tr key={mk} className="border-b border-stone-800/50 hover:bg-stone-800/20">
        {/* Provider */}
        <td className="px-4 py-2.5">
          <span className={`text-xs px-1.5 py-0.5 rounded ${providerColor(g.provider)}`}>
            {g.provider}
          </span>
        </td>

        {/* Model */}
        <td className="px-4 py-2.5 font-mono text-xs text-stone-300 max-w-xs truncate">
          {g.model}
        </td>

        {/* Input $/1M — LLM/image use inputPer1M; TTS uses perChar (displayed as $/1M tok) */}
        <td className="px-4 py-2.5">
          {hasInput ? numInput(g.provider, g.model, 'inputPer1M')
           : hasChar ? (
            <div className="flex items-center gap-1.5">
              {numInput(g.provider, g.model, 'perChar')}
              <span className="text-stone-600 text-xs">$/1M tok</span>
            </div>
          ) : <span className="text-stone-700 text-xs">—</span>}
        </td>

        {/* Output $/1M — LLM only */}
        <td className="px-4 py-2.5">
          {hasOutput
            ? numInput(g.provider, g.model, 'outputPer1M')
            : <span className="text-stone-700 text-xs">—</span>}
        </td>

        {/* Unit price — perImage, perMinute */}
        <td className="px-4 py-2.5">
          {unitMetric ? (
            <div className="flex items-center gap-2">
              {numInput(g.provider, g.model, unitMetric)}
              <span className="text-stone-500 text-xs">{unitLabel(unitMetric)}</span>
            </div>
          ) : (
            <span className="text-stone-700 text-xs">—</span>
          )}
        </td>

        {/* Save button */}
        <td className="px-4 py-2.5">
          <button
            onClick={() => saveModel(g)}
            disabled={saving[mk] || !dirty}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors whitespace-nowrap ${
              saved[mk]
                ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400'
                : dirty
                ? 'bg-amber-800/40 border-amber-700 text-amber-300 hover:bg-amber-800/60'
                : 'bg-stone-800 border-stone-700 text-stone-600 cursor-default'
            }`}
          >
            {saving[mk] ? '...' : saved[mk] ? '✓ Saved' : 'Update'}
          </button>
        </td>

        {/* Updated */}
        <td className="px-4 py-2.5 text-stone-600 text-xs whitespace-nowrap">
          {new Date(g.updated_at).toLocaleDateString()}
        </td>
      </tr>
    );
  }

  return (
    <section>
      <h2 className="text-stone-300 text-sm tracking-widest uppercase mb-4">Model Pricing</h2>
      <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-800 text-stone-500 text-xs tracking-wide uppercase">
              <th className="text-left px-4 py-3">Provider</th>
              <th className="text-left px-4 py-3">Model</th>
              <th className="text-left px-4 py-3">Input $/1M tok</th>
              <th className="text-left px-4 py-3">Output $/1M tok</th>
              <th className="text-left px-4 py-3">Unit price</th>
              <th className="px-4 py-3"></th>
              <th className="text-left px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {llmGroups.length > 0 && (
              <tr className="bg-stone-800/20">
                <td colSpan={7} className="px-4 py-1 text-stone-600 text-xs uppercase tracking-widest">
                  LLM — per token
                </td>
              </tr>
            )}
            {llmGroups.map(renderGroup)}
            {otherGroups.length > 0 && (
              <tr className="bg-stone-800/20">
                <td colSpan={7} className="px-4 py-1 text-stone-600 text-xs uppercase tracking-widest">
                  TTS / Image / STT — per unit
                </td>
              </tr>
            )}
            {otherGroups.map(renderGroup)}
            {groups.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-600">
                  No pricing data — will populate on first API call
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="px-4 py-2 text-stone-700 text-xs border-t border-stone-800">
          TTS values shown as $/1M tokens (auto-converts to/from internal perChar). Enter or Update to save.
        </p>
      </div>
    </section>
  );
}
