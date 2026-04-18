'use client';

import { useState } from 'react';
import type { ScenarioGeneratedBy } from '@/types';

interface FormState {
  title: string;
  titleUk: string;
  premise: string;
  era: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  minPlayers: number;
  maxPlayers: number;
  isCampaign: boolean;
  estimatedSessions: number;
  language: 'uk' | 'en';
}

interface SaveResponse {
  saved?: string;
  error?: string;
  generatedBy?: ScenarioGeneratedBy | null;
  images?: { id: string; url: string; label: string }[];
  generatedImageIds?: string[];
  imageFailures?: { id: string; error: string }[];
  ambientByLocation?: Record<string, string>;
  generatedAmbientIds?: string[];
  materialErrors?: { stage: 'images' | 'ambient'; error: string }[];
}

const DEFAULT: FormState = {
  title: '',
  titleUk: '',
  premise: '',
  era: '1920s',
  difficulty: 'beginner',
  minPlayers: 1,
  maxPlayers: 4,
  isCampaign: false,
  estimatedSessions: 1,
  language: 'uk',
};

export default function ScenarioGenerator({ onSaved }: { onSaved?: () => void }) {
  const [form, setForm] = useState<FormState>(DEFAULT);
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [meta, setMeta] = useState<{
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    fallbackReason?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveMeta, setSaveMeta] = useState<SaveResponse | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function generate() {
    setStatus('generating');
    setResult(null);
    setMeta(null);
    setError(null);
    setSaved(false);
    setSaveMeta(null);

    try {
      const res = await fetch('/api/admin/generate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      // Server may return an HTML error page (proxy timeout, etc.) — read as text first.
      const raw = await res.text();
      let data: { scenario?: Record<string, unknown>; error?: string; provider?: string; model?: string; inputTokens?: number; outputTokens?: number; fallbackReason?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError(`HTTP ${res.status} — non-JSON response:\n${raw.slice(0, 500)}`);
        setStatus('error');
        return;
      }

      if (!res.ok || data.error) {
        setError(data.error ?? `HTTP ${res.status}`);
        setStatus('error');
        return;
      }
      setResult(data.scenario ?? null);
      setMeta({
        provider: data.provider,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        fallbackReason: data.fallbackReason,
      });
      setStatus('done');
    } catch (err) {
      setError(String(err));
      setStatus('error');
    }
  }

  async function saveToFile() {
    if (!result) return;
    const id = result.id as string;
    if (!id) { setError('Scenario has no id field'); return; }
    const generatedBy = (meta?.provider === 'anthropic' || meta?.provider === 'gemini') && meta?.model
      ? {
          provider: meta.provider,
          model: meta.model,
          generatedAt: new Date().toISOString(),
          fallbackFrom: meta.fallbackReason ? 'claude-opus-4-7' : null,
        } satisfies ScenarioGeneratedBy
      : undefined;

    setSaving(true);
    setError(null);
    const res = await fetch('/api/admin/generate-scenario/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, json: result, generatedBy }),
    });
    const data = await res.json() as SaveResponse;
    setSaving(false);
    if (!res.ok || data.error) {
      setError(data.error ?? 'Save failed');
    } else {
      setSaved(true);
      setSaveMeta(data);
      onSaved?.();
    }
  }

  async function copyJson() {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputCls = 'w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-600';
  const labelCls = 'block text-xs text-stone-500 uppercase tracking-wide mb-1';

  return (
    <section>
      <h2 className="text-stone-300 text-sm tracking-widest uppercase mb-4">Scenario Generator</h2>
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-6">

        {/* Row 1: titles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Title (English)</label>
            <input
              className={inputCls}
              placeholder="The Haunting"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Назва (Ukrainian)</label>
            <input
              className={inputCls}
              placeholder="Привид"
              value={form.titleUk}
              onChange={(e) => set('titleUk', e.target.value)}
            />
          </div>
        </div>

        {/* Premise */}
        <div>
          <label className={labelCls}>Premise (3–5 sentences: setting, conflict, what players investigate)</label>
          <textarea
            className={`${inputCls} h-28 resize-y`}
            placeholder="Boston, 1920. A Victorian house on Elm Street has a dark history — tenants flee in terror or go mad. The landlord hires investigators to find out why."
            value={form.premise}
            onChange={(e) => set('premise', e.target.value)}
          />
        </div>

        {/* Row 2: era, difficulty, language */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Era</label>
            <input
              className={inputCls}
              placeholder="1920s"
              value={form.era}
              onChange={(e) => set('era', e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Difficulty</label>
            <select
              className={inputCls}
              value={form.difficulty}
              onChange={(e) => set('difficulty', e.target.value as FormState['difficulty'])}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Content language</label>
            <select
              className={inputCls}
              value={form.language}
              onChange={(e) => set('language', e.target.value as FormState['language'])}
            >
              <option value="uk">Ukrainian</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* Row 3: players + campaign */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-28">
            <label className={labelCls}>Min players</label>
            <input
              type="number" min={1} max={4}
              className={inputCls}
              value={form.minPlayers}
              onChange={(e) => set('minPlayers', Number(e.target.value))}
            />
          </div>
          <div className="w-28">
            <label className={labelCls}>Max players</label>
            <input
              type="number" min={1} max={4}
              className={inputCls}
              value={form.maxPlayers}
              onChange={(e) => set('maxPlayers', Number(e.target.value))}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-amber-600 w-4 h-4"
              checked={form.isCampaign}
              onChange={(e) => set('isCampaign', e.target.checked)}
            />
            <span className="text-sm text-stone-300">Campaign</span>
          </label>

          {form.isCampaign && (
            <div className="w-36">
              <label className={labelCls}>Sessions</label>
              <input
                type="number" min={1} max={20}
                className={inputCls}
                value={form.estimatedSessions}
                onChange={(e) => set('estimatedSessions', Number(e.target.value))}
              />
            </div>
          )}

          <div className="text-xs text-stone-500 max-w-xs leading-relaxed">
            Saving now also kicks off static image and ambient generation, then reuses the files from shared VPS storage.
          </div>
        </div>

        {/* Generate button */}
        <div className="flex items-center gap-3">
          <button
            onClick={generate}
            disabled={status === 'generating' || !form.title || !form.titleUk || !form.premise}
            className="px-5 py-2.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-stone-100 text-sm rounded-xl transition-colors font-medium"
          >
            {status === 'generating' ? 'Generating…' : 'Generate Scenario'}
          </button>
          {status === 'generating' && (
            <span className="text-xs text-stone-500">Generating with Claude Opus 4.7 — this can take 1–3 min</span>
          )}
        </div>

        {/* Error */}
        {status === 'error' && error && (
          <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-300 text-sm whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* Result */}
        {status === 'done' && result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-400 uppercase tracking-wide">
                Generated: <span className="text-amber-400">{result.id as string}</span>
                {meta?.model && (
                  <span className="ml-3 text-stone-500 normal-case tracking-normal">
                    via {meta.provider}/{meta.model}
                    {typeof meta.inputTokens === 'number' && typeof meta.outputTokens === 'number' && (
                      <> · {meta.inputTokens} in / {meta.outputTokens} out tok</>
                    )}
                    {meta.fallbackReason && <span className="text-amber-500"> · fallback</span>}
                  </span>
                )}
                {saved && <span className="text-emerald-500 ml-3">Saved + materials generated ✓</span>}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyJson}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-xs rounded-lg transition-colors"
                >
                  {copied ? 'Copied ✓' : 'Copy JSON'}
                </button>
                <button
                  onClick={saveToFile}
                  disabled={saving || saved}
                  className="px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-800/60 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-700 text-emerald-300 text-xs rounded-lg transition-colors"
                >
                  {saving ? 'Saving + generating…' : saved ? 'Saved ✓' : 'Save + generate materials'}
                </button>
              </div>
            </div>
            {saveMeta && (
              <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-4 text-xs text-stone-300 space-y-2">
                <p>
                  Saved scenario and generated materials from the admin flow.
                  {typeof saveMeta.generatedImageIds?.length === 'number' && ` New images: ${saveMeta.generatedImageIds.length}.`}
                  {typeof saveMeta.generatedAmbientIds?.length === 'number' && ` Ambient tracks: ${saveMeta.generatedAmbientIds.length}.`}
                </p>
                {Boolean(saveMeta.materialErrors?.length) && (
                  <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-amber-200 whitespace-pre-wrap">
                    {`Some material stages failed:\n${saveMeta.materialErrors!.map((item) => `- ${item.stage}: ${item.error}`).join('\n')}`}
                  </div>
                )}
                {Boolean(saveMeta.imageFailures?.length) && (
                  <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-amber-200 whitespace-pre-wrap">
                    {`Some images failed to generate:\n${saveMeta.imageFailures!.map((item) => `- ${item.id}: ${item.error}`).join('\n')}`}
                  </div>
                )}
              </div>
            )}
            <pre className="bg-stone-950 border border-stone-800 rounded-xl p-4 text-xs text-stone-300 overflow-auto max-h-96 leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
