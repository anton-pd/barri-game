'use client';

import { useState, useEffect } from 'react';

const AI_OPTIONS = [
  { value: 'gemini-flash',   label: 'Gemini 2.5 Flash',   note: 'Fast · cheap · default' },
  { value: 'claude-sonnet',  label: 'Claude Sonnet 4.6',  note: 'Slower · premium quality' },
  { value: 'deepseek-flash', label: 'DeepSeek V4 Flash',  note: 'Experimental · cheapest · slow first token' },
];

const TTS_OPTIONS = [
  { value: 'gemini', label: 'Gemini TTS', note: 'Multi-speaker · NPC voices' },
  { value: 'openai', label: 'OpenAI TTS', note: 'Single voice · fallback' },
];

export default function KeeperSettings() {
  const [aiProvider,         setAiProvider]         = useState<string>('gemini-flash');
  const [ttsProvider,        setTtsProvider]        = useState<string>('gemini');
  const [geminiCacheEnabled, setGeminiCacheEnabled] = useState<boolean>(false);
  const [dailyLimitEnabled,  setDailyLimitEnabled]  = useState<boolean>(true);
  const [dailyLimitUsd,      setDailyLimitUsd]      = useState<string>('0.50');
  const [saving, setSaving] = useState<string | null>(null);
  const [saved,  setSaved]  = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.ai_provider)  setAiProvider(data.ai_provider);
        if (data.tts_provider) setTtsProvider(data.tts_provider);
        setGeminiCacheEnabled(data.gemini_cache_enabled === 'true');
        setDailyLimitEnabled(data.daily_limit_enabled !== 'false');
        if (data.daily_user_cost_limit_usd) setDailyLimitUsd(data.daily_user_cost_limit_usd);
      });
  }, []);

  async function save(key: string, value: string) {
    setSaving(key);
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <section>
      <h2 className="text-stone-300 text-sm tracking-widest uppercase mb-4">Keeper Settings</h2>
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-5">

        {/* AI Model */}
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-2">AI Model (affects all sessions)</p>
          <div className="flex gap-2 flex-wrap">
            {AI_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setAiProvider(opt.value); save('ai_provider', opt.value); }}
                disabled={saving === 'ai_provider'}
                className={`flex flex-col items-start px-3.5 py-2.5 rounded-xl border transition-colors text-sm ${
                  aiProvider === opt.value
                    ? 'bg-amber-800/60 border-amber-700 text-amber-200'
                    : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300'
                }`}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="text-[11px] text-stone-500 mt-0.5">{opt.note}</span>
              </button>
            ))}
            {saved === 'ai_provider' && <span className="text-xs text-emerald-500 self-center">Saved ✓</span>}
          </div>
        </div>

        {/* TTS Provider */}
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-2">TTS Provider (affects all sessions)</p>
          <div className="flex gap-2 flex-wrap">
            {TTS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setTtsProvider(opt.value); save('tts_provider', opt.value); }}
                disabled={saving === 'tts_provider'}
                className={`flex flex-col items-start px-3.5 py-2.5 rounded-xl border transition-colors text-sm ${
                  ttsProvider === opt.value
                    ? 'bg-amber-800/60 border-amber-700 text-amber-200'
                    : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300'
                }`}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="text-[11px] text-stone-500 mt-0.5">{opt.note}</span>
              </button>
            ))}
            {saved === 'tts_provider' && <span className="text-xs text-emerald-500 self-center">Saved ✓</span>}
          </div>
        </div>

        {/* Gemini Implicit Cache */}
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Gemini Implicit Cache</p>
          <p className="text-xs text-stone-600 mb-2">
            Separates dynamic state from systemInstruction so ruleset+static prefix is stable across turns.
            Enables Gemini 2.5 Flash implicit caching (75% token discount on ~1500 tokens/req).
            OFF by default — enable to A/B test quality vs combined prompt.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const next = !geminiCacheEnabled;
                setGeminiCacheEnabled(next);
                save('gemini_cache_enabled', String(next));
              }}
              disabled={saving === 'gemini_cache_enabled'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                geminiCacheEnabled ? 'bg-amber-700' : 'bg-stone-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  geminiCacheEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-stone-400">
              {geminiCacheEnabled ? 'ON — split mode (dynamic in history)' : 'OFF — combined mode'}
            </span>
            {saved === 'gemini_cache_enabled' && <span className="text-xs text-emerald-500">Saved ✓</span>}
          </div>
        </div>

        {/* Per-user daily cost cap (ANT-108) */}
        <div className="border-t border-stone-800 pt-5">
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Per-user daily cost cap</p>
          <p className="text-xs text-stone-600 mb-3">
            Blocks a user&apos;s AI turns once their API spend for the day (UTC) reaches the cap.
            Admins are exempt. Resets at midnight UTC.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                const next = !dailyLimitEnabled;
                setDailyLimitEnabled(next);
                save('daily_limit_enabled', String(next));
              }}
              disabled={saving === 'daily_limit_enabled'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                dailyLimitEnabled ? 'bg-amber-700' : 'bg-stone-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  dailyLimitEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-stone-400">{dailyLimitEnabled ? 'ON' : 'OFF'}</span>

            <div className="flex items-center gap-2 ml-2">
              <span className="text-stone-500 text-sm">$</span>
              <input
                type="number"
                step="0.05"
                min="0"
                value={dailyLimitUsd}
                onChange={(e) => setDailyLimitUsd(e.target.value)}
                onBlur={() => save('daily_user_cost_limit_usd', dailyLimitUsd)}
                disabled={!dailyLimitEnabled}
                className="w-24 rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1.5 text-sm text-stone-200 disabled:opacity-50 focus:border-amber-700 focus:outline-none"
              />
              <span className="text-stone-600 text-xs">/ user / day</span>
            </div>
            {(saved === 'daily_limit_enabled' || saved === 'daily_user_cost_limit_usd') && (
              <span className="text-xs text-emerald-500 self-center">Saved ✓</span>
            )}
          </div>
        </div>

        <p className="text-xs text-stone-600">
          Changes take effect on next page load. Currently open sessions refresh on next message.
        </p>
      </div>
    </section>
  );
}
