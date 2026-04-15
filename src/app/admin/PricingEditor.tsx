'use client';

import { useState, useEffect } from 'react';

interface PricingRow {
  provider: string;
  model: string;
  metric: string;
  value_usd: number;
  updated_at: string;
}

// Display conversion: perChar is stored internally but shown as $/1M tokens (4 chars/token)
function toDisplay(metric: string, value: number): number {
  if (metric === 'perChar') return parseFloat((value * 4_000_000).toPrecision(6));
  return value;
}

function toStorage(metric: string, displayValue: number): number {
  if (metric === 'perChar') return displayValue / 4_000_000;
  return displayValue;
}

function metricLabel(metric: string): string {
  switch (metric) {
    case 'inputPer1M':  return 'Input $/1M tokens';
    case 'outputPer1M': return 'Output $/1M tokens';
    case 'perChar':     return '$/1M tokens (TTS)';
    case 'perImage':    return '$/image';
    case 'perMinute':   return '$/minute';
    default:            return metric;
  }
}

function metricUnit(metric: string): string {
  switch (metric) {
    case 'inputPer1M':
    case 'outputPer1M':
    case 'perChar':     return '$/1M tok';
    case 'perImage':    return '$/img';
    case 'perMinute':   return '$/min';
    default:            return '';
  }
}

export default function PricingEditor() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  // key = `${provider}|${model}|${metric}`, value = current input string
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved,  setSaved]  = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/admin/pricing')
      .then(r => r.json())
      .then((data: PricingRow[]) => {
        setRows(data);
        const initial: Record<string, string> = {};
        for (const r of data) {
          initial[key(r)] = String(toDisplay(r.metric, r.value_usd));
        }
        setEdits(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  function key(r: Pick<PricingRow, 'provider' | 'model' | 'metric'>): string {
    return `${r.provider}|${r.model}|${r.metric}`;
  }

  async function save(row: PricingRow) {
    const k = key(row);
    const displayVal = parseFloat(edits[k] ?? '0');
    if (isNaN(displayVal) || displayVal < 0) return;

    setSaving(s => ({ ...s, [k]: true }));
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider:  row.provider,
          model:     row.model,
          metric:    row.metric,
          value_usd: toStorage(row.metric, displayVal),
        }),
      });
      if (res.ok) {
        setSaved(s => ({ ...s, [k]: true }));
        setTimeout(() => setSaved(s => ({ ...s, [k]: false })), 2000);
        // Update local rows so updated_at reflects change
        setRows(prev => prev.map(r =>
          key(r) === k ? { ...r, value_usd: toStorage(row.metric, displayVal), updated_at: new Date().toISOString() } : r
        ));
      }
    } finally {
      setSaving(s => ({ ...s, [k]: false }));
    }
  }

  // Group rows: first LLM/TTS (per-token), then image/stt
  const tokenRows  = rows.filter(r => ['inputPer1M', 'outputPer1M', 'perChar'].includes(r.metric));
  const otherRows  = rows.filter(r => !['inputPer1M', 'outputPer1M', 'perChar'].includes(r.metric));

  if (loading) return <p className="text-stone-600 text-sm py-4">Завантаження...</p>;

  function renderRow(row: PricingRow) {
    const k = key(row);
    const isDirty = parseFloat(edits[k] ?? '') !== toDisplay(row.metric, row.value_usd);
    return (
      <tr key={k} className="border-b border-stone-800/50 hover:bg-stone-800/20">
        <td className="px-4 py-2.5">
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            row.provider === 'anthropic' ? 'bg-amber-900/40 text-amber-400' :
            row.provider === 'gemini'    ? 'bg-blue-900/40 text-blue-400' :
                                          'bg-stone-700 text-stone-400'
          }`}>{row.provider}</span>
        </td>
        <td className="px-4 py-2.5 font-mono text-xs text-stone-300">{row.model}</td>
        <td className="px-4 py-2.5 text-stone-400 text-xs">{metricLabel(row.metric)}</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-600 text-xs">$</span>
            <input
              type="number"
              min="0"
              step="any"
              value={edits[k] ?? ''}
              onChange={e => setEdits(prev => ({ ...prev, [k]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && save(row)}
              className="w-28 px-2 py-1 rounded bg-stone-800 border border-stone-700 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-stone-600 text-xs">{metricUnit(row.metric)}</span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <button
            onClick={() => save(row)}
            disabled={saving[k] || !isDirty}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
              saved[k]
                ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400'
                : isDirty
                ? 'bg-amber-800/40 border-amber-700 text-amber-300 hover:bg-amber-800/60'
                : 'bg-stone-800 border-stone-700 text-stone-600 cursor-default'
            }`}
          >
            {saving[k] ? '...' : saved[k] ? '✓ Saved' : 'Update'}
          </button>
        </td>
        <td className="px-4 py-2.5 text-stone-600 text-xs">
          {new Date(row.updated_at).toLocaleDateString()}
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
              <th className="text-left px-4 py-3">Metric</th>
              <th className="text-left px-4 py-3">Value</th>
              <th className="px-4 py-3"></th>
              <th className="text-left px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tokenRows.length > 0 && (
              <tr className="bg-stone-800/20">
                <td colSpan={6} className="px-4 py-1.5 text-stone-600 text-xs uppercase tracking-widest">
                  LLM &amp; TTS — billed per token
                </td>
              </tr>
            )}
            {tokenRows.map(renderRow)}
            {otherRows.length > 0 && (
              <tr className="bg-stone-800/20">
                <td colSpan={6} className="px-4 py-1.5 text-stone-600 text-xs uppercase tracking-widest">
                  Image &amp; STT — billed per unit
                </td>
              </tr>
            )}
            {otherRows.map(renderRow)}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-600">
                  No pricing data yet — will populate on first API call
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="px-4 py-2 text-stone-700 text-xs border-t border-stone-800">
          TTS perChar values are displayed and edited as $/1M tokens (÷ 4 chars/token). Press Enter or click Update to save.
        </p>
      </div>
    </section>
  );
}
