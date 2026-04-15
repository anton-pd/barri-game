'use client';

import { useState, useEffect } from 'react';
import type { GameSession, Scenario, Player } from '@/types';
// CHANGED: Use getRolesForScenario to get scenario-specific roles
import { getRolesForScenario, makePlayer, type RolePreset } from '@/lib/roles';
import AuthBar from './AuthBar';

interface DraftPlayer {
  name: string;
  preset: RolePreset | null;
}

const emptyDraft = (): DraftPlayer => ({ name: '', preset: null });

export default function SessionList() {
  const [sessions, setSessions] = useState<(GameSession & { last_message?: string })[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [showNewGame, setShowNewGame] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [drafts, setDrafts] = useState<DraftPlayer[]>([emptyDraft()]);
  const [pickingRoleFor, setPickingRoleFor] = useState<number | null>(null);
  const [language, setLanguage] = useState<'uk' | 'en'>('uk');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/sessions').then((r) => r.json()),
      fetch('/api/scenarios').then((r) => r.json()),
    ]).then(([s, sc]) => {
      setSessions(s);
      setScenarios(sc);
      setLoading(false);
    });
  }, []);

  function addDraft() {
    if (drafts.length < 4) setDrafts((prev) => [...prev, emptyDraft()]);
  }

  function removeDraft(idx: number) {
    if (drafts.length > 1) setDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  function setDraftName(idx: number, name: string) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, name } : d)));
  }

  function setDraftPreset(idx: number, preset: RolePreset) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, preset } : d)));
    setPickingRoleFor(null);
  }

  const canCreate =
    !isCreating &&
    !!sessionName.trim() &&
    drafts.every((d) => d.name.trim() && d.preset !== null);

  async function createSession() {
    if (!canCreate || !selectedScenario) return;
    setIsCreating(true);

    const players: Player[] = drafts.map((d) => makePlayer(d.name.trim(), d.preset!));

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: selectedScenario.id, name: sessionName, players, language }),
      });
      if (!res.ok) throw new Error('Failed');
      const session = await res.json();
      window.location.href = `/session/${session.id}`;
    } catch {
      setIsCreating(false);
    }
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Видалити цю сесію?')) return;
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  function closeModal() {
    setShowNewGame(false);
    setSelectedScenario(null);
    setSessionName('');
    setDrafts([emptyDraft()]);
    setPickingRoleFor(null);
    setLanguage('uk');
  }

  const difficultyLabel = (d: string) => {
    if (d === 'beginner')     return { text: 'Початківець', color: 'text-green-400',  bg: 'bg-green-900/30 border-green-800/40'  };
    if (d === 'intermediate') return { text: 'Середній',    color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800/40' };
    return                           { text: 'Складний',    color: 'text-red-400',    bg: 'bg-red-900/30 border-red-800/40'       };
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">

        {/* Auth bar */}
        <div className="flex justify-end mb-4">
          <AuthBar />
        </div>

        {/* Hero */}
        <div className="text-center mb-10">
          <p className="text-4xl mb-3 select-none">🐙</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-amber-500 tracking-tight mb-1">
            Call of Cthulhu
          </h1>
          <p className="text-stone-500 text-sm">AI Keeper — Поклик Ктулху <span className="text-stone-700">· v0.2.0</span></p>
          <div className="mt-6 flex items-center gap-3 text-stone-800 select-none">
            <div className="flex-1 h-px bg-stone-800" />
            <span className="text-xs tracking-widest uppercase">Ph&apos;nglui mglw&apos;nafh</span>
            <div className="flex-1 h-px bg-stone-800" />
          </div>
        </div>

        {/* New game button */}
        <button
          onClick={() => setShowNewGame(true)}
          className="w-full py-3.5 mb-8 bg-amber-800 hover:bg-amber-700 active:bg-amber-900 rounded-2xl text-amber-100 font-semibold text-base transition-colors shadow-lg shadow-amber-950/30"
        >
          + Нова гра
        </button>

        {/* Sessions */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-stone-900 rounded-2xl animate-pulse border border-stone-800" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-stone-600 py-12">
            <p>Немає активних сесій. Почніть нову гру!</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-[11px] text-stone-600 uppercase tracking-widest mb-3 px-1">Активні сесії</h2>
            {sessions.map((s) => (
              <a
                key={s.id}
                href={`/session/${s.id}`}
                className="group flex items-center gap-3 bg-stone-900 hover:bg-stone-800 active:bg-stone-800 border border-stone-800 hover:border-stone-700 rounded-2xl p-4 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <h3 className="font-semibold text-stone-200 truncate">{s.name}</h3>
                    <span className="text-xs text-stone-600 shrink-0">Акт {s.world_state?.act || 1}</span>
                  </div>
                  <p className="text-xs text-stone-600 mb-2">
                    {s.scenario_id} · {new Date(s.updated_at).toLocaleDateString('uk-UA')}
                  </p>
                  {s.last_message && (
                    <p className="text-xs text-stone-600 truncate italic mb-2">«{s.last_message}»</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {(s.players as Player[]).map((p, i) => (
                      <span key={i} className="text-xs bg-stone-800 group-hover:bg-stone-700 text-stone-400 rounded-full px-2 py-0.5 transition-colors">
                        {p.name} · {p.role}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => deleteSession(s.id, e)}
                    className="text-stone-700 hover:text-red-500 active:text-red-400 text-sm p-1.5 transition-colors"
                    title="Видалити сесію"
                  >
                    🗑
                  </button>
                  <span className="text-amber-700 group-hover:text-amber-500 transition-colors">→</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Modal — bottom sheet on mobile, centered on desktop */}
      {showNewGame && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-stone-900 border border-stone-700 sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain">
            {/* Drag handle (mobile only) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-stone-700 rounded-full" />
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-stone-200">Нова гра</h2>
                <button onClick={closeModal} className="text-stone-500 hover:text-stone-300 active:text-stone-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-800 transition-colors text-xl leading-none">✕</button>
              </div>

              {/* Role picker overlay */}
              {pickingRoleFor !== null ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => setPickingRoleFor(null)}
                      className="text-amber-600 hover:text-amber-500 text-sm py-1 pr-2"
                    >← Назад</button>
                    <span className="text-sm text-stone-400">
                      Клас для {drafts[pickingRoleFor].name || `Гравця ${pickingRoleFor + 1}`}
                    </span>
                  </div>
                  {/* CHANGED: Show roles scoped to selected scenario */}
                  <div className="space-y-2">
                    {(selectedScenario ? getRolesForScenario(selectedScenario) : []).map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setDraftPreset(pickingRoleFor, preset)}
                        className="w-full text-left bg-stone-800 hover:bg-stone-750 active:bg-stone-700 border border-stone-700 hover:border-stone-600 rounded-xl p-3.5 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-stone-200 text-sm">{preset.name}</span>
                          <div className="flex gap-2 text-xs">
                            <span className="text-red-400">HP {preset.hp}</span>
                            <span className="text-purple-400">SAN {preset.sanity}</span>
                          </div>
                        </div>
                        <p className="text-xs text-stone-500 mb-2 leading-relaxed">{preset.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(preset.skills).map(([skill, val]) => (
                            <span key={skill} className="text-xs bg-stone-700 text-stone-400 rounded-full px-2 py-0.5">
                              {skill} {val}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

              ) : !selectedScenario ? (
                /* Scenario picker */
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-3">Оберіть сценарій</p>
                  <div className="space-y-2">
                    {scenarios.map((sc) => {
                      const diff = difficultyLabel(sc.difficulty);
                      return (
                        <button
                          key={sc.id}
                          onClick={() => setSelectedScenario(sc)}
                          className="w-full text-left bg-stone-800 hover:bg-stone-750 active:bg-stone-700 border border-stone-700 hover:border-stone-600 rounded-xl p-4 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h3 className="font-semibold text-stone-200 text-sm">{sc.titleUk}</h3>
                              <p className="text-xs text-stone-500">{sc.era}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-xs border rounded-full px-2 py-0.5 ${diff.color} ${diff.bg}`}>
                                {diff.text}
                              </span>
                              {/* CHANGED: Show campaign/one-shot badge and player limits */}
                              {sc.sessionConfig && (
                                <span className="text-xs text-stone-600">
                                  {sc.sessionConfig.isCampaign ? '📖 кампанія' : '⚡ one-shot'}
                                  {' · '}{sc.sessionConfig.minPlayers}–{sc.sessionConfig.maxPlayers} гравці
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-stone-500 leading-relaxed">{sc.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

              ) : (
                /* Player setup */
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => setSelectedScenario(null)}
                      className="text-amber-600 hover:text-amber-500 py-1 pr-2"
                    >←</button>
                    <span className="text-stone-400 truncate">{selectedScenario.titleUk}</span>
                  </div>

                  <div>
                    <label className="text-xs text-stone-500 uppercase tracking-wide block mb-1.5">Назва сесії</label>
                    <input
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="Напр: Ніч у Бостоні"
                      className="w-full bg-stone-800 border border-stone-700 focus:border-amber-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-200 placeholder-stone-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-stone-500 uppercase tracking-wide block mb-1.5">Мова гри</label>
                    <div className="flex gap-2">
                      {(['uk', 'en'] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setLanguage(lang)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                            language === lang
                              ? 'bg-amber-800/60 border-amber-700 text-amber-300'
                              : 'bg-stone-800 border-stone-700 text-stone-500 hover:border-stone-600 hover:text-stone-400'
                          }`}
                        >
                          {lang === 'uk' ? '🇺🇦 Українська' : '🇬🇧 English'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-stone-500 uppercase tracking-wide block mb-2">Гравці (1–4)</label>
                    <div className="space-y-2.5">
                      {drafts.map((d, i) => (
                        <div key={i} className="bg-stone-800/60 border border-stone-700/50 rounded-xl p-3.5">
                          <div className="flex gap-2 items-center mb-2.5">
                            <input
                              type="text"
                              value={d.name}
                              onChange={(e) => setDraftName(i, e.target.value)}
                              placeholder={`Ім'я гравця ${i + 1}`}
                              className="flex-1 bg-stone-700 border border-stone-600 focus:border-amber-700 rounded-lg px-3 py-2 text-sm text-stone-200 placeholder-stone-500 focus:outline-none transition-colors"
                            />
                            {drafts.length > 1 && (
                              <button
                                onClick={() => removeDraft(i)}
                                className="text-stone-600 hover:text-red-500 active:text-red-400 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-700 transition-colors"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {d.preset ? (
                            <button
                              onClick={() => setPickingRoleFor(i)}
                              className="w-full text-left bg-stone-700 hover:bg-stone-600 active:bg-stone-650 rounded-lg px-3 py-2.5 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-stone-200">{d.preset.name}</span>
                                <div className="flex gap-2 text-xs items-center">
                                  <span className="text-red-400">HP {d.preset.hp}</span>
                                  <span className="text-purple-400">SAN {d.preset.sanity}</span>
                                  <span className="text-stone-500 text-[11px]">змінити →</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {Object.entries(d.preset.skills).map(([skill, val]) => (
                                  <span key={skill} className="text-xs text-stone-500">
                                    {skill} {val}
                                  </span>
                                ))}
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => setPickingRoleFor(i)}
                              className="w-full py-2.5 text-sm text-amber-700 hover:text-amber-500 active:text-amber-400 border border-dashed border-stone-600 hover:border-amber-800 rounded-xl transition-colors"
                            >
                              + Обрати клас
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {drafts.length < 4 && (
                      <button
                        onClick={addDraft}
                        className="text-xs text-amber-700 hover:text-amber-500 active:text-amber-400 mt-3 py-1"
                      >
                        + Додати гравця
                      </button>
                    )}
                  </div>

                  <button
                    onClick={createSession}
                    disabled={!canCreate}
                    className="w-full py-3 bg-amber-800 hover:bg-amber-700 active:bg-amber-900 disabled:bg-stone-700 disabled:cursor-not-allowed rounded-2xl text-amber-100 font-semibold text-base transition-colors"
                  >
                    {isCreating ? 'Створення...' : 'Почати гру'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
